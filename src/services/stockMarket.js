// src/services/stockMarket.js
import Stock from '../models/Stock.js';
import Portfolio from '../models/Portfolio.js';
import User from '../models/User.js';
import cron from 'node-cron';
import { createCanvas } from 'canvas';
import { getUser, addCoins, removeCoins } from './economy.js';
import logger from '../utils/logger.js';

// Stock cap: maximum total shares in circulation per stock listing
const STOCK_CAP = 50000;

// Initialize default stocks on startup
export async function initStocks() {
  try {
    logger.info('[STOCK] Ensuring default stocks exist...');

    const defaults = [
      {
        ticker: 'NEXI',
        name: 'NEXI Coin',
        price: 150,
        volatility: 0.12,
        factors: { memberGrowth: 0.15, messageActivity: 0.25 },
      },
      { ticker: 'TECH', name: 'Tech Giants Inc.', price: 300, volatility: 0.08 },
      { ticker: 'GME', name: 'GameStop Corp.', price: 50, volatility: 0.2 },
      { ticker: 'CRYPTO', name: 'Crypto Index', price: 200, volatility: 0.15 },
      { ticker: 'RETAIL', name: 'Retail Leaders', price: 80, volatility: 0.1 },
      { ticker: 'ENERGY', name: 'Energy Co.', price: 120, volatility: 0.09 },
      { ticker: 'HEALTH', name: 'Health Corp.', price: 90, volatility: 0.07 },
      { ticker: 'FINANCE', name: 'Finance Group', price: 110, volatility: 0.06 },
    ];

    let created = 0;
    for (const def of defaults) {
      const found = await Stock.findOne({ ticker: def.ticker });
      if (!found) {
        await Stock.create(def);
        created++;
        logger.info(`[STOCK] Created default stock ${def.ticker}`);
      }
    }

    if (created === 0) logger.info('[STOCK] All default stocks already exist, skipping creation');
    else logger.info(`[STOCK] ✓ Default stocks initialized (${created} created)`);
  } catch (error) {
    logger.error('[STOCK] Error initializing stocks:', error);
  }
}

// Update all stock prices (run hourly)
export async function updateAllPrices(client) {
  const stocks = await Stock.find({});

  // Gather server/global metrics once per tick (used as market signals)
  const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
  const onlineMembers = client.guilds.cache.reduce((acc, g) => acc + g.members.cache.filter(m => m.presence?.status === 'online').size, 0);
  const totalGuilds = client.guilds.cache.size;
  const textChannels = client.channels.cache.filter(c => c.isTextBased()).size;

  for (const stock of stocks) {
    let newPrice = stock.price;

    // Configuration: caps and scaling
    const MAX_PCT_CHANGE = 0.05; // max 5% per tick
    const MIN_PRICE = 1;

    // Base random fluctuation (percent-based)
    const baseFluctuationPct = (Math.random() - 0.5) * (stock.volatility || 0.1);
    newPrice = Math.max(MIN_PRICE, newPrice * (1 + baseFluctuationPct));

    // Market signal calculation (applies to all stocks)
    // Get previous metrics (store in stock.metadata if available)
    const prevMembers = stock.metadata?.prevMembers || totalMembers;
    const prevGuilds = stock.metadata?.prevGuilds || totalGuilds;

    // Calculate deltas (rates of change)
    const memberDelta = totalMembers - prevMembers;
    const guildDelta = totalGuilds - prevGuilds;
    const onlineRatio = totalMembers > 0 ? onlineMembers / totalMembers : 0;

    // Convert impacts to percentage-of-price (so large prices don't explode)
    const memberGrowthFactor = stock.factors?.memberGrowth || 0.02; // smaller default for non-community stocks
    const messageActivityFactor = stock.factors?.messageActivity || 0.02;

    const memberGrowthPct = (memberDelta / Math.max(1, prevMembers)) * memberGrowthFactor * 0.05;
    const guildGrowthPct = (guildDelta / Math.max(1, prevGuilds)) * 0.03;
    const engagementPct = onlineRatio * 0.02;
    const channelActivityPct = (textChannels / Math.max(1, totalGuilds)) * messageActivityFactor * 0.02;

    // Aggregate percentage impact
    let totalImpactPct = memberGrowthPct + guildGrowthPct + engagementPct + channelActivityPct;

    // Mean reversion: if price is far above recent average, apply negative pressure (and vice-versa)
    const histPrices = stock.history?.map(h => h.price) || [];
    if (histPrices.length >= 3) {
      const avg = histPrices.reduce((a, b) => a + b, 0) / histPrices.length;
      const deviation = (stock.price - avg) / Math.max(1, avg);
      // Apply a small opposing force proportional to deviation
      totalImpactPct += -Math.sign(deviation) * Math.min(0.02, Math.abs(deviation) * 0.05);
    }

    // Liquidity scaling: higher-priced / low-liquidity assets should move less
    const liquidityScale = 1 / (1 + Math.log10(Math.max(1, stock.price)));
    totalImpactPct *= liquidityScale;

    // Cap impact to configured max per tick
    const cappedPct = Math.max(-MAX_PCT_CHANGE, Math.min(MAX_PCT_CHANGE, totalImpactPct));

    newPrice = Math.max(MIN_PRICE, Math.round(newPrice * (1 + cappedPct)));

    // Update metadata for next calculation
    stock.metadata = {
      prevMembers: totalMembers,
      prevGuilds: totalGuilds,
      lastEngagementRatio: onlineRatio,
    };

    newPrice = Math.max(1, Math.round(newPrice));

    // Add to history (keep last 24)
    stock.history.push({ timestamp: new Date(), price: newPrice });
    if (stock.history.length > 24) stock.history.shift();

    stock.price = newPrice;
    stock.lastUpdated = new Date();

    await stock.save();
  }

  console.log('[STOCK] All prices updated');
}

// Start hourly price updates
export function startPriceUpdates(client) {
  // Run at the top of every hour to prevent runaway minute-by-minute compounding
  cron.schedule('0 * * * *', async () => {
    logger.info('[STOCK CRON] Starting price update...');
    await updateAllPrices(client);
    logger.info('[STOCK CRON] Update complete');
  });

  logger.info('[STOCK] Price update cron scheduled (hourly)');
}

// Get single stock
export async function getStock(ticker) {
  return await Stock.findOne({ ticker: ticker.toUpperCase() });
}

// Get all stocks
export async function getMarket() {
  return await Stock.find({}).sort({ price: -1 });
}

// Calculate total shares in circulation for a specific stock
async function getTotalSharesForTicker(ticker) {
  const portfolios = await Portfolio.find({});
  let total = 0;
  for (const portfolio of portfolios) {
    const stock = portfolio.stocks.find(s => s.ticker === ticker);
    if (stock) {
      total += stock.quantity;
    }
  }
  return total;
}

// Get remaining shares available for a stock
export async function getRemainingSharesForTicker(ticker) {
  const total = await getTotalSharesForTicker(ticker);
  return STOCK_CAP - total;
}

// Buy stock
export async function buyStock(userId, username, ticker, quantity) {
  const stock = await getStock(ticker);
  if (!stock) throw new Error('Stock not found');

  const cost = stock.price * quantity;

  const user = await getUser(userId, username);
  if (user.balance < cost) throw new Error('Insufficient balance');

  // Check per-stock cap
  const currentTotal = await getTotalSharesForTicker(ticker);
  if (currentTotal + quantity > STOCK_CAP) {
    const remaining = STOCK_CAP - currentTotal;
    throw new Error(`Stock cap reached for ${ticker}. Maximum buy: ${remaining} shares. Current total: ${currentTotal}/${STOCK_CAP}`);
  }

  await removeCoins(userId, cost, username);

  let portfolio = await Portfolio.findOne({ userId });
  if (!portfolio) {
    portfolio = new Portfolio({ userId, stocks: [] });
  }

  const existing = portfolio.stocks.find(s => s.ticker === ticker);
  if (existing) {
    const newQty = existing.quantity + quantity;
    existing.buyPrice = ((existing.buyPrice * existing.quantity) + (stock.price * quantity)) / newQty;
    existing.quantity = newQty;
  } else {
    portfolio.stocks.push({
      ticker,
      quantity,
      buyPrice: stock.price,
    });
  }

  await portfolio.save();

  return { cost, newBalance: user.balance - cost };
}

// Sell stock
export async function sellStock(userId, ticker, quantity) {
  const stock = await getStock(ticker);
  if (!stock) throw new Error('Stock not found');

  const portfolio = await Portfolio.findOne({ userId });
  if (!portfolio) throw new Error('No portfolio found');

  const holding = portfolio.stocks.find(s => s.ticker === ticker);
  if (!holding || holding.quantity < quantity) throw new Error('Insufficient shares');

  const revenue = stock.price * quantity;

  holding.quantity -= quantity;
  if (holding.quantity <= 0) {
    portfolio.stocks = portfolio.stocks.filter(s => s.ticker !== ticker);
  }

  await portfolio.save();
  
  // Fetch user to get username for addCoins
  const user = await User.findOne({ userId });
  if (!user) throw new Error('User not found');
  
  await addCoins(userId, revenue, user.username);

  return { revenue, remaining: holding.quantity };
}

// Get user portfolio
export async function getPortfolio(userId) {
  const portfolio = await Portfolio.findOne({ userId });
  return portfolio?.stocks || [];
}

// Generate chart (last 24 hours)
export async function generateChart(ticker) {
  const stock = await getStock(ticker);
  if (!stock || stock.history.length < 2) throw new Error('Not enough price history');

  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#2f3136';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Line chart
  const prices = stock.history.map(h => h.price);
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const range = max - min || 1;

  ctx.beginPath();
  ctx.strokeStyle = '#57f287';
  ctx.lineWidth = 3;

  prices.forEach((price, index) => {
    const x = (index / (prices.length - 1)) * (canvas.width - 40) + 20;
    const y = canvas.height - 40 - ((price - min) / range) * (canvas.height - 80);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  // Labels
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px Arial';
  ctx.fillText(`${ticker} Price History (24h)`, 20, 30);
  ctx.fillText(`$${min.toLocaleString()}`, 20, canvas.height - 10);
  ctx.fillText(`$${max.toLocaleString()}`, 20, 40);

  return canvas.toBuffer();
}