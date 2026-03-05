// src/services/stockMarket.js
import mongoose from 'mongoose';
import Stock from '../models/Stock.js';
import cron from 'node-cron';
import { createCanvas } from 'canvas';
import logger from '../utils/logger.js';
import { getUser, addCoins, removeCoins } from './economy.js';

// ─────────────────────────────────────────────────────────────────────────────
// Mongoose Models
// ─────────────────────────────────────────────────────────────────────────────

const portfolioSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  stocks: [{
    ticker: { type: String, required: true },
    quantity: { type: Number, default: 0 },
    buyPrice: { type: Number, default: 0 },
  }],
  createdAt: { type: Date, default: Date.now },
});

const Portfolio = mongoose.models.Portfolio || mongoose.model('Portfolio', portfolioSchema);

// ─────────────────────────────────────────────────────────────────────────────
// Default stocks initialization
// ─────────────────────────────────────────────────────────────────────────────

export async function initStocks() {
  try {
    logger.info('[STOCK] Ensuring default stocks exist...');

    const defaults = [
      { ticker: 'NEXI', name: 'NEXI Coin', price: 150, volatility: 0.10 },
      { ticker: 'TECH', name: 'Tech Giants Inc.', price: 280, volatility: 0.08 },
      { ticker: 'GME', name: 'GameStop Corp.', price: 45, volatility: 0.18 },
      { ticker: 'CRYPTO', name: 'Crypto Index', price: 220, volatility: 0.15 },
      { ticker: 'RETAIL', name: 'Retail Leaders', price: 75, volatility: 0.09 },
    ];

    let created = 0;
    for (const def of defaults) {
      const exists = await Stock.findOne({ ticker: def.ticker });
      if (!exists) {
        await Stock.create(def);
        created++;
        logger.info(`[STOCK] Created default stock: ${def.ticker}`);
      }
    }

    logger.info(`[STOCK] Initialization complete (${created} new stocks created)`);
  } catch (err) {
    logger.error('[STOCK INIT] Failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Price update algorithm (hourly) – minimal NEXI influence
// ─────────────────────────────────────────────────────────────────────────────

export async function updateAllPrices(client) {
  try {
    const stocks = await Stock.find({});
    logger.info(`[STOCK] Starting hourly price update for ${stocks.length} stocks...`);

    for (const stock of stocks) {
      let newPrice = stock.price;

      // 1. Random fluctuation
      const randomPct = (Math.random() - 0.5) * stock.volatility * 2;
      newPrice *= (1 + randomPct);

      // 2. Light upward trend
      const trendPct = 0.0015;
      newPrice *= (1 + trendPct);

      // 3. Gentle mean reversion
      const longTermMean = stock.ticker === 'NEXI' ? 160 : 200;
      const deviation = (longTermMean - newPrice) / longTermMean;
      newPrice += deviation * 0.8;

      // 4. NEXI Coin – VERY MINIMAL server influence (as requested)
      if (stock.ticker === 'NEXI') {
        const totalMembers = client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0);
        const memberImpact = (totalMembers / 10000) * 0.008; // tiny effect
        newPrice *= (1 + memberImpact);
      }

      // Safety bounds
      newPrice = Math.max(5, Math.round(newPrice * 100) / 100);

      // Add to history (keep last 24)
      stock.history.push({ timestamp: new Date(), price: newPrice });
      if (stock.history.length > 24) stock.history.shift();

      stock.price = newPrice;
      stock.lastUpdated = new Date();

      await stock.save();
    }

    logger.info('[STOCK] Hourly price update completed successfully');
  } catch (err) {
    logger.error('[STOCK UPDATE] Failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Start hourly price updates
// ─────────────────────────────────────────────────────────────────────────────

export function startPriceUpdates(client) {
  cron.schedule('0 * * * *', () => updateAllPrices(client));
  logger.info('[STOCK] Price update cron scheduled (hourly)');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

export async function getStock(ticker) {
  return await Stock.findOne({ ticker: ticker.toUpperCase() });
}

export async function getMarket() {
  return await Stock.find({}).sort({ price: -1 });
}

// Buy stock
export async function buyStock(userId, username, ticker, quantity) {
  const stock = await getStock(ticker);
  if (!stock) throw new Error('Stock not found');

  // Enforce stock limit
  const remaining = await getRemainingSharesForTicker(ticker);
  if (quantity > remaining) {
    throw new Error(`Not enough shares available. Only ${remaining.toLocaleString()} left (limit: 5,000,000 per stock).`);
  }

  const cost = Math.round(stock.price * quantity);
  const user = await getUser(userId, username);
  if (user.balance < cost) throw new Error('Insufficient balance');

  await removeCoins(userId, cost);

  let portfolio = await Portfolio.findOne({ userId });
  if (!portfolio) portfolio = new Portfolio({ userId, stocks: [] });

  const existing = portfolio.stocks.find(s => s.ticker === ticker);
  if (existing) {
    const newQty = existing.quantity + quantity;
    existing.buyPrice = ((existing.buyPrice * existing.quantity) + (stock.price * quantity)) / newQty;
    existing.quantity = newQty;
  } else {
    portfolio.stocks.push({ ticker, quantity, buyPrice: stock.price });
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

  const revenue = Math.round(stock.price * quantity);

  holding.quantity -= quantity;
  if (holding.quantity <= 0) {
    portfolio.stocks = portfolio.stocks.filter(s => s.ticker !== ticker);
  }

  await portfolio.save();
  await addCoins(userId, revenue);

  return { revenue, remaining: holding.quantity };
}

// Get portfolio
export async function getPortfolio(userId) {
  const portfolio = await Portfolio.findOne({ userId });
  return portfolio?.stocks || [];
}

// Calculate how many shares remain available for a given ticker
export async function getRemainingSharesForTicker(ticker) {
  // total supply is now 5,000,000 shares per stock
  const portfolios = await Portfolio.find({ 'stocks.ticker': ticker });
  let used = 0;
  for (const p of portfolios) {
    const holding = p.stocks.find(s => s.ticker === ticker);
    if (holding) used += holding.quantity;
  }
  return Math.max(0, 5000000 - used);
}

// ---------- destructive helpers (owner only) ----------
export async function wipeStocks() {
  await Stock.deleteMany({});
  logger.warn('[STOCK] All stocks collection wiped by owner action');
}

export async function wipePortfolios() {
  await Portfolio.deleteMany({});
  logger.warn('[STOCK] All portfolios wiped by owner action');
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS CHART – Your original code fully restored
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Auto-start on import
// ─────────────────────────────────────────────────────────────────────────────

initStocks().catch(err => logger.error('[STOCK INIT] Failed:', err.message));
// startPriceUpdates is intentionally not invoked here because it requires a
// Discord client instance.  The ready event handler passes the client and
// schedules the cron job instead.
// startPriceUpdates().catch(err => logger.error('[STOCK CRON] Failed to start:', err.message));