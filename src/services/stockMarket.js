// src/services/stockMarket.js
import Stock from '../models/Stock.js';
import Portfolio from '../models/Portfolio.js';
import User from '../models/User.js';
import cron from 'node-cron';
import { createCanvas } from 'canvas';
import { getUser, addCoins, removeCoins } from './economy.js';
import logger from '../utils/logger.js';

// Initialize default stocks on startup
export async function initStocks() {
  try {
    logger.info('[STOCK] Checking for existing stocks...');
    const existing = await Stock.findOne({ ticker: 'NEXI' });
    
    if (!existing) {
      logger.info('[STOCK] No stocks found. Creating default stocks...');
      await Stock.create({
        ticker: 'NEXI',
        name: 'NEXI Coin',
        price: 150,
        volatility: 0.12,
        factors: { memberGrowth: 0.15, messageActivity: 0.25 },
      });
      await Stock.create({
        ticker: 'TECH',
        name: 'Tech Giants Inc.',
        price: 300,
        volatility: 0.08,
      });
      await Stock.create({
        ticker: 'GME',
        name: 'GameStop Corp.',
        price: 50,
        volatility: 0.2,
      });
      await Stock.create({
        ticker: 'CRYPTO',
        name: 'Crypto Index',
        price: 200,
        volatility: 0.15,
      });
      await Stock.create({
        ticker: 'RETAIL',
        name: 'Retail Leaders',
        price: 80,
        volatility: 0.1,
      });
      await Stock.create({
        ticker: 'ENERGY',
        name: 'Energy Co.',
        price: 120,
        volatility: 0.09,
      });
      await Stock.create({
        ticker: 'HEALTH',
        name: 'Health Corp.',
        price: 90,
        volatility: 0.07,
      });
      await Stock.create({
        ticker: 'FINANCE',
        name: 'Finance Group',
        price: 110,
        volatility: 0.06,
      });
      logger.info('[STOCK] ✓ Default stocks initialized (8 new stocks created)');
    } else {
      logger.info('[STOCK] Stocks already exist in database, skipping initialization');
    }
  } catch (error) {
    logger.error('[STOCK] Error initializing stocks:', error);
  }
}

// Update all stock prices (run hourly)
export async function updateAllPrices(client) {
  const stocks = await Stock.find({});

  for (const stock of stocks) {
    let newPrice = stock.price;

    // Random fluctuation
    const fluctuation = (Math.random() - 0.5) * stock.volatility * newPrice;
    newPrice += fluctuation;

    // NEXI special: server variables (advanced calculation)
    if (stock.ticker === 'NEXI') {
      // Get current metrics
      const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
      const onlineMembers = client.guilds.cache.reduce((acc, g) => acc + g.members.cache.filter(m => m.presence?.status === 'online').size, 0);
      const totalGuilds = client.guilds.cache.size;
      const textChannels = client.channels.cache.filter(c => c.isTextBased()).size;
      
      // Get previous metrics (store in stock.metadata if available)
      const prevMembers = stock.metadata?.prevMembers || totalMembers;
      const prevGuilds = stock.metadata?.prevGuilds || totalGuilds;
      
      // Calculate deltas (rates of change)
      const memberDelta = totalMembers - prevMembers;
      const guildDelta = totalGuilds - prevGuilds;
      const onlineRatio = totalMembers > 0 ? onlineMembers / totalMembers : 0;
      
      // Advanced weighted factors
      const memberGrowthImpact = (memberDelta / Math.max(1, prevMembers)) * stock.factors.memberGrowth * (stock.price * 0.05);
      const guildGrowthImpact = (guildDelta / Math.max(1, prevGuilds)) * 0.1 * (stock.price * 0.03);
      const engagementImpact = onlineRatio * 0.15 * (stock.price * 0.02);
      const channelActivityImpact = (textChannels / Math.max(1, totalGuilds)) * stock.factors.messageActivity * (stock.price * 0.02);
      
      // Apply momentum (dampen extreme changes)
      const totalImpact = memberGrowthImpact + guildGrowthImpact + engagementImpact + channelActivityImpact;
      const cappedImpact = Math.max(-stock.price * 0.1, Math.min(stock.price * 0.1, totalImpact));
      
      newPrice += cappedImpact;
      
      // Update metadata for next calculation
      stock.metadata = {
        prevMembers: totalMembers,
        prevGuilds: totalGuilds,
        lastEngagementRatio: onlineRatio
      };
    }

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
  cron.schedule('* * * * *', async () => {
    logger.info('[STOCK CRON] Starting price update...');
    await updateAllPrices(client);
    logger.info('[STOCK CRON] Update complete');
  });

  logger.info('[STOCK] Price update cron scheduled (every minute)');
}

// Get single stock
export async function getStock(ticker) {
  return await Stock.findOne({ ticker: ticker.toUpperCase() });
}

// Get all stocks
export async function getMarket() {
  return await Stock.find({}).sort({ price: -1 });
}

// Buy stock
export async function buyStock(userId, username, ticker, quantity) {
  const stock = await getStock(ticker);
  if (!stock) throw new Error('Stock not found');

  const cost = stock.price * quantity;

  const user = await getUser(userId, username);
  if (user.balance < cost) throw new Error('Insufficient balance');

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