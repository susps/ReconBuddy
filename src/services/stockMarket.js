// src/services/stockMarket.js
import Stock from '../models/Stock.js';
import Portfolio from '../models/Portfolio.js';
import User from '../models/User.js';
import cron from 'node-cron';
import { createCanvas } from 'canvas';

// Initialize default stocks on startup
export async function initStocks() {
  const existing = await Stock.findOne({ ticker: 'NEXI' });
  if (!existing) {
    await Stock.create({
      ticker: 'NEXI',
      name: 'NEXI Coin',
      price: 100,
      volatility: 0.12,
      factors: { memberGrowth: 0.15, messageActivity: 0.25 },
    });
    await Stock.create({
      ticker: 'TECH',
      name: 'Tech Giants Inc.',
      price: 250,
      volatility: 0.08,
    });
    console.log('[STOCK] Default stocks initialized');
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

    // NEXI special: server variables
    if (stock.ticker === 'NEXI') {
      const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
      const memberGrowth = totalMembers * stock.factors.memberGrowth;

      // Placeholder message activity (improve later with real tracking)
      const messageActivity = client.channels.cache.size * stock.factors.messageActivity;

      newPrice += memberGrowth + messageActivity;
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
  cron.schedule('0 * * * *', () => updateAllPrices(client));
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

  await removeCoins(userId, cost);

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
  await addCoins(userId, revenue);

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