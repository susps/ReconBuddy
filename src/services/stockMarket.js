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
      // Core
      { ticker: 'NEXI', name: 'NEXI Coin', price: 150, volatility: 0.10 },
      // Technology
      { ticker: 'TECH', name: 'Tech Giants Inc.', price: 300, volatility: 0.08 },
      { ticker: 'AAPL', name: 'Apple Corp.', price: 420, volatility: 0.06 },
      { ticker: 'MSFT', name: 'Microsoft Ltd.', price: 480, volatility: 0.05 },
      { ticker: 'GGLE', name: 'Alphabet Inc.', price: 350, volatility: 0.07 },
      { ticker: 'AMZN', name: 'Amazon Group', price: 390, volatility: 0.08 },
      { ticker: 'META', name: 'Meta Platforms', price: 310, volatility: 0.09 },
      { ticker: 'NVDA', name: 'NovaTech GPUs', price: 550, volatility: 0.14 },
      { ticker: 'CHIP', name: 'ChipWorks Semi', price: 180, volatility: 0.11 },
      { ticker: 'AIML', name: 'AI/ML Dynamics', price: 260, volatility: 0.16 },
      { ticker: 'CYBER', name: 'CyberShield Sec.', price: 145, volatility: 0.10 },
      { ticker: 'CLOUD', name: 'CloudNine Hosting', price: 210, volatility: 0.08 },
      // Gaming
      { ticker: 'GME', name: 'GameStop Corp.', price: 50, volatility: 0.20 },
      { ticker: 'GAME', name: 'GameDev Studios', price: 95, volatility: 0.13 },
      { ticker: 'ESPT', name: 'eSports League Co.', price: 65, volatility: 0.15 },
      // Crypto & Blockchain
      { ticker: 'CRYPTO', name: 'Crypto Index', price: 200, volatility: 0.15 },
      { ticker: 'BITC', name: 'Bitcoin Trust', price: 500, volatility: 0.18 },
      { ticker: 'ETHE', name: 'Ethereum Fund', price: 320, volatility: 0.17 },
      { ticker: 'BLOCK', name: 'Blockchain Infra', price: 110, volatility: 0.13 },
      // Finance
      { ticker: 'FINANCE', name: 'Finance Group', price: 110, volatility: 0.06 },
      { ticker: 'BANK', name: 'Global Bank Corp.', price: 160, volatility: 0.05 },
      { ticker: 'INSUR', name: 'InsureAll Ltd.', price: 85, volatility: 0.04 },
      { ticker: 'FINTK', name: 'FinTek Pay', price: 130, volatility: 0.10 },
      // Retail & Consumer
      { ticker: 'RETAIL', name: 'Retail Leaders', price: 80, volatility: 0.10 },
      { ticker: 'LUXE', name: 'Luxe Brands Co.', price: 240, volatility: 0.07 },
      { ticker: 'FOOD', name: 'FoodCorp Global', price: 70, volatility: 0.04 },
      { ticker: 'BREW', name: 'BrewHouse Inc.', price: 55, volatility: 0.06 },
      // Energy
      { ticker: 'ENERGY', name: 'Energy Co.', price: 120, volatility: 0.09 },
      { ticker: 'OIL', name: 'PetroGlobe Oil', price: 140, volatility: 0.11 },
      { ticker: 'SOLAR', name: 'SolarFlare Energy', price: 100, volatility: 0.12 },
      { ticker: 'NUKE', name: 'NuclePower Inc.', price: 175, volatility: 0.08 },
      { ticker: 'WIND', name: 'WindStream Energy', price: 88, volatility: 0.09 },
      // Healthcare
      { ticker: 'HEALTH', name: 'Health Corp.', price: 90, volatility: 0.07 },
      { ticker: 'PHARMA', name: 'PharmaCure Inc.', price: 195, volatility: 0.10 },
      { ticker: 'BIO', name: 'BioGenix Labs', price: 230, volatility: 0.14 },
      // Automotive & Transport
      { ticker: 'AUTO', name: 'AutoMakers Ltd.', price: 155, volatility: 0.08 },
      { ticker: 'ELEC', name: 'ElectraCar Co.', price: 280, volatility: 0.13 },
      { ticker: 'AIR', name: 'AeroJet Airways', price: 105, volatility: 0.11 },
      { ticker: 'SHIP', name: 'OceanFreight Inc.', price: 60, volatility: 0.07 },
      // Space & Defence
      { ticker: 'SPACE', name: 'StellarX Aerospace', price: 340, volatility: 0.15 },
      { ticker: 'DEFNS', name: 'DefenceCore Corp.', price: 200, volatility: 0.06 },
      { ticker: 'ORBIT', name: 'OrbitLink Satellites', price: 125, volatility: 0.12 },
      // Media & Entertainment
      { ticker: 'MEDIA', name: 'MediaWave Corp.', price: 115, volatility: 0.09 },
      { ticker: 'STRM', name: 'StreamFlix Inc.', price: 190, volatility: 0.10 },
      { ticker: 'MUSIC', name: 'BeatDrop Records', price: 45, volatility: 0.11 },
      // Real Estate & Telecom
      { ticker: 'REIT', name: 'Prime Realty Trust', price: 135, volatility: 0.05 },
      { ticker: 'TELCO', name: 'TelcoNet Group', price: 95, volatility: 0.06 },
      // Mining & Commodities
      { ticker: 'MINE', name: 'DeepRock Mining', price: 75, volatility: 0.12 },
      { ticker: 'GOLD', name: 'GoldVault Reserve', price: 310, volatility: 0.08 },
      { ticker: 'STEEL', name: 'IronForge Metals', price: 65, volatility: 0.09 },
      // Travel & Leisure
      { ticker: 'TRVL', name: 'TravelSphere Co.', price: 82, volatility: 0.10 },
      { ticker: 'HOTEL', name: 'GrandStay Hotels', price: 110, volatility: 0.07 },
      { ticker: 'CRUIS', name: 'OceanVoyage Lines', price: 58, volatility: 0.11 },
      // Meme & Speculative
      { ticker: 'MEME', name: 'MemeStock Inc.', price: 25, volatility: 0.25 },
      { ticker: 'MOON', name: 'ToTheMoon Fund', price: 15, volatility: 0.30 },
      { ticker: 'DOGE', name: 'DogeIndustries', price: 10, volatility: 0.28 },
      { ticker: 'APE', name: 'DiamondHands Ltd.', price: 35, volatility: 0.22 },
      { ticker: 'YOLO', name: 'YOLO Ventures', price: 20, volatility: 0.26 },
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
// Trade impact constants
// ─────────────────────────────────────────────────────────────────────────────

const K_IMMEDIATE  = 0.15;   // per-trade sensitivity
const MAX_IMMEDIATE_IMPACT = 0.01; // ±1% cap per individual trade
const K_VOLUME     = 0.5;    // hourly aggregate sensitivity
const MAX_VOLUME_IMPACT = 3.0; // ±300% cap per hourly tick
const MIN_PRICE    = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Record a trade for hourly aggregate calculation
// ─────────────────────────────────────────────────────────────────────────────

async function recordTrade(stock, quantity, side) {
  stock.metadata = stock.metadata || { pendingBuys: 0, pendingSells: 0 };
  if (side === 'buy')  stock.metadata.pendingBuys  = (stock.metadata.pendingBuys  || 0) + quantity;
  else                 stock.metadata.pendingSells = (stock.metadata.pendingSells || 0) + quantity;
  stock.markModified('metadata');
  await stock.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply immediate per-trade price impact
// Buys push price up, sells push price down — scaled by circulating supply
// ─────────────────────────────────────────────────────────────────────────────

async function applyImmediateTradeImpact(stock, quantity, side) {
  const circulatingSupply = await getCirculatingSupply(stock.ticker);
  const liquidityScale = 1 / (1 + Math.log10(Math.max(1, stock.price)));
  const rawImpact = (quantity / Math.max(1, circulatingSupply)) * K_IMMEDIATE * liquidityScale;
  const cappedImpact = Math.min(rawImpact, MAX_IMMEDIATE_IMPACT);
  const direction = side === 'buy' ? 1 : -1;

  stock.price = Math.max(MIN_PRICE, Math.round(stock.price * (1 + direction * cappedImpact) * 100) / 100);
  stock.lastUpdated = new Date();
  await stock.save();

  logger.info(`[STOCK] Immediate ${side} impact on ${stock.ticker}: ${(direction * cappedImpact * 100).toFixed(4)}% (${quantity} shares)`);
}

// Helper – total shares currently held by all users for a ticker
async function getCirculatingSupply(ticker) {
  const portfolios = await Portfolio.find({ 'stocks.ticker': ticker });
  let total = 0;
  for (const p of portfolios) {
    const h = p.stocks.find(s => s.ticker === ticker);
    if (h) total += h.quantity;
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// Price update algorithm (hourly) – includes trade-volume impact
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

      // 3. Gentle mean reversion (toward each stock's initial listing price)
      const defaultPrices = {
        NEXI: 150, TECH: 300, AAPL: 420, MSFT: 480, GGLE: 350, AMZN: 390, META: 310,
        NVDA: 550, CHIP: 180, AIML: 260, CYBER: 145, CLOUD: 210,
        GME: 50, GAME: 95, ESPT: 65,
        CRYPTO: 200, BITC: 500, ETHE: 320, BLOCK: 110,
        FINANCE: 110, BANK: 160, INSUR: 85, FINTK: 130,
        RETAIL: 80, LUXE: 240, FOOD: 70, BREW: 55,
        ENERGY: 120, OIL: 140, SOLAR: 100, NUKE: 175, WIND: 88,
        HEALTH: 90, PHARMA: 195, BIO: 230,
        AUTO: 155, ELEC: 280, AIR: 105, SHIP: 60,
        SPACE: 340, DEFNS: 200, ORBIT: 125,
        MEDIA: 115, STRM: 190, MUSIC: 45,
        REIT: 135, TELCO: 95,
        MINE: 75, GOLD: 310, STEEL: 65,
        TRVL: 82, HOTEL: 110, CRUIS: 58,
        MEME: 25, MOON: 15, DOGE: 10, APE: 35, YOLO: 20,
      };
      const longTermMean = defaultPrices[stock.ticker] || stock.price;
      const deviation = (longTermMean - newPrice) / longTermMean;
      newPrice += deviation * 0.8;

      // 4. NEXI Coin – VERY MINIMAL server influence (as requested)
      if (stock.ticker === 'NEXI') {
        const totalMembers = client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0);
        const memberImpact = (totalMembers / 10000) * 0.008;
        newPrice *= (1 + memberImpact);
      }

      // 5. Trade-volume impact (mass-buy / mass-sell pressure)
      const meta = stock.metadata || { pendingBuys: 0, pendingSells: 0 };
      const pendingBuys  = meta.pendingBuys  || 0;
      const pendingSells = meta.pendingSells || 0;
      const vNet = pendingBuys - pendingSells;

      if (vNet !== 0) {
        const circulatingSupply = await getCirculatingSupply(stock.ticker);
        const volumeRatio = vNet / Math.max(1, circulatingSupply);
        const rawVolumeImpact = K_VOLUME * volumeRatio;
        const liquidityScale = 1 / (1 + Math.log10(Math.max(1, newPrice)));
        const volumeImpactPct = Math.max(-MAX_VOLUME_IMPACT, Math.min(MAX_VOLUME_IMPACT, rawVolumeImpact * liquidityScale));

        newPrice *= (1 + volumeImpactPct);
        logger.info(`[STOCK] ${stock.ticker} trade-volume impact: net=${vNet}, impact=${(volumeImpactPct * 100).toFixed(4)}%`);
      }

      // Reset pending counters for next tick
      stock.metadata = { ...(stock.metadata || {}), pendingBuys: 0, pendingSells: 0 };
      stock.markModified('metadata');

      // Safety bounds
      newPrice = Math.max(MIN_PRICE, Math.round(newPrice * 100) / 100);

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

  // Record trade volume & apply immediate price bump
  await recordTrade(stock, quantity, 'buy');
  await applyImmediateTradeImpact(stock, quantity, 'buy');

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

  // Record trade volume & apply immediate price dip
  await recordTrade(stock, quantity, 'sell');
  await applyImmediateTradeImpact(stock, quantity, 'sell');

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