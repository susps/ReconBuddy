// src/index.js
import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// discord.js – default import + direct access (stable ESM pattern)
// ─────────────────────────────────────────────────────────────────────────────
import discord from 'discord.js';

// ─────────────────────────────────────────────────────────────────────────────
// MongoDB & Mongoose
// ─────────────────────────────────────────────────────────────────────────────
import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Logger (structured logging)
// ─────────────────────────────────────────────────────────────────────────────
import { log } from './utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// Component loader
// ─────────────────────────────────────────────────────────────────────────────
import { loadComponents } from './handlers/componentHandler.js';

// ─────────────────────────────────────────────────────────────────────────────
// Paths & environment
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOKEN = process.env.DISCORD_TOKEN?.trim();

if (!TOKEN) {
  log.error('DISCORD_TOKEN is missing or empty in .env');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Client setup
// ─────────────────────────────────────────────────────────────────────────────

const client = new discord.Client({
  intents: [
    discord.IntentsBitField.Flags.Guilds,
    discord.IntentsBitField.Flags.GuildMembers,
    discord.IntentsBitField.Flags.GuildVoiceStates,
    discord.IntentsBitField.Flags.GuildMessages,
    discord.IntentsBitField.Flags.MessageContent,
    discord.IntentsBitField.Flags.GuildMessageReactions,
  ],
  partials: [
    discord.Partials.Message,
    discord.Partials.Channel,
    discord.Partials.Reaction,
    discord.Partials.User,
  ],
  allowedMentions: { parse: [] },
});

// Shared state
client.commands = new discord.Collection();
client.cooldowns = new discord.Collection();
client.db = null; // Will hold Mongoose connection reference

// ─────────────────────────────────────────────────────────────────────────────
// Loader functions
// ─────────────────────────────────────────────────────────────────────────────

async function loadEvents() {
  const eventsDir = path.join(__dirname, 'events');
  let count = 0;

  try {
    const files = (await fs.readdir(eventsDir)).filter(f => f.endsWith('.js') || f.endsWith('.mjs'));

    for (const file of files) {
      const filePath = path.join(eventsDir, file);
      const fileUrl = pathToFileURL(filePath).href;

      const event = await import(fileUrl);

      if (!event?.name || typeof event.execute !== 'function') {
        log.warn(`Invalid event file: ${file}`);
        continue;
      }

      const register = event.once ? client.once : client.on;
      register.call(client, event.name, (...args) => event.execute(...args, client));

      log.info(`[EVENT] Loaded → ${event.name}${event.once ? ' (once)' : ''}`);
      count++;
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      log.warn('events/ directory not found – skipping');
    } else {
      log.error('Failed to load events:', err.message);
    }
  }

  return count;
}

async function loadCommands() {
  const commandsDir = path.join(__dirname, 'commands');
  let count = 0;

  try {
    const items = await fs.readdir(commandsDir);
    log.debug(`Raw items in commands/: ${items.join(', ')}`);

    const categories = [];

    for (const item of items) {
      const itemPath = path.join(commandsDir, item);
      const stat = await fs.stat(itemPath);

      if (stat.isDirectory()) {
        categories.push(item);
        log.debug(`Directory found: ${item}`);
      } else {
        log.debug(`File skipped (not directory): ${item}`);
      }
    }

    for (const category of categories) {
      const catPath = path.join(commandsDir, category);
      const files = (await fs.readdir(catPath)).filter(f => f.endsWith('.js') || f.endsWith('.mjs'));

      log.debug(`Category "${category}" has files: ${files.join(', ') || '(empty)'}`);

      for (const file of files) {
        const filePath = path.join(catPath, file);
        const fileUrl = pathToFileURL(filePath).href;

        try {
          const command = await import(fileUrl);

          if (!command?.data?.name || typeof command.execute !== 'function') {
            log.warn(`Invalid command: ${path.join(category, file)}`);
            continue;
          }

          client.commands.set(command.data.name, command);
          log.info(`[CMD] Loaded → /${command.data.name} (${category})`);
          count++;
        } catch (err) {
          log.error(`Failed to load ${path.join(category, file)}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    log.error('Failed to load commands folder:', err.message);
  }

  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Database (using Mongoose)
// ─────────────────────────────────────────────────────────────────────────────

async function initDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI?.trim();

  if (!MONGODB_URI) {
    log.warn('No MONGODB_URI provided – database disabled');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      // Modern options (no deprecated ones)
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip IPv6
    });

    client.db = mongoose.connection.db; // Raw DB reference if needed
    log.info('MongoDB connected successfully with Mongoose');
  } catch (err) {
    log.error('MongoDB connection failed:', err.message);
    client.db = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Startup sequence
// ─────────────────────────────────────────────────────────────────────────────

async function bootstrap() {
  log.info('Starting bot...');

  const eventsLoaded = await loadEvents();
  const commandsLoaded = await loadCommands();

  await initDatabase();

  await loadComponents(client);

  log.info(`Ready: ${eventsLoaded} events • ${commandsLoaded} commands`);

  // Start status rotation
  const { startStatusRotation } = await import('./utils/statusRotator.js');
  startStatusRotation(client);

  client.login(TOKEN).catch(err => {
    log.err(err, 'Login failed');
    process.exit(1);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Global error handling
// ─────────────────────────────────────────────────────────────────────────────

process.on('unhandledRejection', (reason, promise) => {
  log.err(reason, 'Unhandled Rejection');
});

process.on('uncaughtException', err => {
  log.err(err, 'Uncaught Exception');
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard server integration
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import os from 'node:os';
import crypto from 'node:crypto';

const dashboardApp = express();
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 3001;
const dashboardDir = path.join(__dirname, '../dashboard/public');

// Trust proxy (nginx)
dashboardApp.set('trust proxy', 1);

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID?.trim();
const DISCORD_CLIENT_SECRET = (process.env.DISCORD_CLIENT_SECRET || process.env.DISCORD_SECRET)?.trim();
const DASHBOARD_URL = process.env.DASHBOARD_URL?.trim() || `http://localhost:${DASHBOARD_PORT}`;
const DISCORD_REDIRECT_URI = `${DASHBOARD_URL}/auth/callback`;
const COOKIE_SECRET = process.env.COOKIE_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

// Simple in-memory session store (keyed by session token)
const sessions = new Map();

// Cookie helpers
function setSessionCookie(res, token) {
  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 86400000,
    path: '/',
  });
}

function getSessionToken(req) {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1] : null;
}

function getSession(req) {
  const token = getSessionToken(req);
  return token ? sessions.get(token) : null;
}

// Discord OAuth2 login redirect
dashboardApp.get('/auth/login', (req, res) => {
  if (!DISCORD_CLIENT_ID) return res.status(500).send('DISCORD_CLIENT_ID not configured');
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// Discord OAuth2 callback
dashboardApp.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/');

  try {
    // Exchange code for token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      log.error('OAuth2 token exchange failed:', JSON.stringify(tokenData));
      return res.redirect('/');
    }

    // Fetch user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    // Fetch user guilds
    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const guilds = await guildsRes.json();

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionToken, {
      user,
      guilds: Array.isArray(guilds) ? guilds : [],
      accessToken: tokenData.access_token,
      createdAt: Date.now(),
    });

    setSessionCookie(res, sessionToken);
    res.redirect('/');
  } catch (err) {
    log.error('OAuth2 callback error:', err.message);
    res.redirect('/');
  }
});

// Logout
dashboardApp.get('/auth/logout', (req, res) => {
  const token = getSessionToken(req);
  if (token) sessions.delete(token);
  res.cookie('session', '', { httpOnly: true, maxAge: 0, path: '/' });
  res.redirect('/');
});

// Get current user info
dashboardApp.get('/api/me', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.json({ loggedIn: false });

  const { user, guilds } = session;
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % 6n}.png`;

  // Find mutual guilds (guilds both user and bot are in)
  const botGuildIds = new Set(client.guilds.cache.map(g => g.id));
  const mutualGuilds = guilds.filter(g => botGuildIds.has(g.id));

  // Fetch user database info
  let dbUser = null;
  let portfolio = null;
  let warnings = [];

  try {
    const UserModel = (await import('./models/User.js')).default;
    const PortfolioModel = (await import('./models/Portfolio.js')).default;
    const StockModel = (await import('./models/Stock.js')).default;

    dbUser = await UserModel.findOne({ userId: user.id }).lean();
    portfolio = await PortfolioModel.findOne({ userId: user.id }).lean();

    // Calculate portfolio value
    if (portfolio?.stocks?.length) {
      const tickers = portfolio.stocks.map(s => s.ticker);
      const stocks = await StockModel.find({ ticker: { $in: tickers } }).lean();
      const priceMap = Object.fromEntries(stocks.map(s => [s.ticker, s.price]));
      portfolio.stocks = portfolio.stocks.map(s => ({
        ...s,
        currentPrice: priceMap[s.ticker] || 0,
        value: (priceMap[s.ticker] || 0) * s.quantity,
      }));
      portfolio.totalValue = portfolio.stocks.reduce((sum, s) => sum + s.value, 0);
    }

    // Read warnings from warnings.json
    try {
      const warningsPath = path.join(__dirname, '..', 'warnings.json');
      const warningsData = JSON.parse(await fs.readFile(warningsPath, 'utf-8'));
      warnings = warningsData[user.id] || [];
    } catch { /* no warnings file */ }
  } catch (err) {
    log.error('Failed to fetch user DB data:', err.message);
  }

  res.json({
    loggedIn: true,
    user: {
      id: user.id,
      username: user.username,
      globalName: user.global_name || user.username,
      discriminator: user.discriminator,
      avatar: avatarUrl,
    },
    economy: dbUser ? {
      balance: dbUser.balance,
      dailyStreak: dbUser.dailyStreak,
      inventory: dbUser.inventory?.length || 0,
    } : null,
    portfolio: portfolio ? {
      stocks: portfolio.stocks || [],
      totalValue: portfolio.totalValue || 0,
    } : null,
    warnings,
    mutualGuilds: mutualGuilds.length,
    totalGuilds: guilds.length,
  });
});

dashboardApp.get('/api/stats', (req, res) => {
  const uptime = process.uptime();
  const mem = process.memoryUsage();
  const cpus = os.cpus();

  const guilds = client.guilds.cache;
  const firstGuild = guilds.first();

  res.json({
    bot: {
      uptime: Math.floor(uptime),
      memoryUsage: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss
      },
      guildCount: guilds.size,
      userCount: guilds.reduce((total, g) => total + g.memberCount, 0),
      commandsLoaded: client.commands.size,
      discordJsVersion: discord.version,
      nodeVersion: process.version,
      os: `${os.type()} ${os.release()}`,
      cpu: `${cpus.length} cores (${cpus[0]?.model || 'Unknown'})`
    },
    server: firstGuild ? {
      name: firstGuild.name,
      memberCount: firstGuild.memberCount,
      channelCount: firstGuild.channels.cache.size
    } : {
      name: 'N/A',
      memberCount: 0,
      channelCount: 0
    }
  });
});

// ─── JSON body parser for casino API ───────────────────────────────────────
dashboardApp.use(express.json());

// ─── Casino API routes ────────────────────────────────────────────────────

const SLOTS_SYMBOLS = [
  { emoji: '🍒', name: 'Cherry', payout: 2 },
  { emoji: '🍋', name: 'Lemon', payout: 3 },
  { emoji: '🍊', name: 'Orange', payout: 4 },
  { emoji: '🍇', name: 'Grape', payout: 5 },
  { emoji: '🔔', name: 'Bell', payout: 10 },
  { emoji: '💎', name: 'Diamond', payout: 20 },
];

function requireAuth(req, res) {
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'Not logged in' }); return null; }
  return session;
}

async function getEconFunctions() {
  const econ = await import('./services/economy.js');
  return econ;
}

// POST /api/casino/slots
dashboardApp.post('/api/casino/slots', async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  try {
    const { getUser, removeCoins, addCoins, addToHouse } = await getEconFunctions();
    const bet = parseInt(req.body.bet, 10);
    if (!Number.isInteger(bet) || bet < 1 || bet > 500) return res.status(400).json({ error: 'Bet must be 1-500' });

    const user = await getUser(session.user.id, session.user.username);
    if (user.balance < bet) return res.status(400).json({ error: 'Insufficient balance' });

    await removeCoins(session.user.id, bet);
    await addToHouse(bet);

    const reel1 = SLOTS_SYMBOLS[Math.floor(Math.random() * SLOTS_SYMBOLS.length)];
    const reel2 = SLOTS_SYMBOLS[Math.floor(Math.random() * SLOTS_SYMBOLS.length)];
    const reel3 = SLOTS_SYMBOLS[Math.floor(Math.random() * SLOTS_SYMBOLS.length)];

    let payout = 0;
    if (reel1.emoji === reel2.emoji && reel2.emoji === reel3.emoji) {
      payout = bet * reel1.payout * 2;
    } else if (reel1.emoji === reel2.emoji || reel2.emoji === reel3.emoji || reel1.emoji === reel3.emoji) {
      payout = bet * reel1.payout;
    }
    if (payout > 0) await addCoins(session.user.id, payout);

    const updated = await getUser(session.user.id);
    res.json({ reels: [reel1.emoji, reel2.emoji, reel3.emoji], payout, bet, balance: updated.balance });
  } catch (err) { log.error('Casino slots error:', err.message); res.status(500).json({ error: 'Internal error' }); }
});

// POST /api/casino/roulette
dashboardApp.post('/api/casino/roulette', async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  try {
    const { getUser, removeCoins, addCoins, addToHouse } = await getEconFunctions();
    const bet = parseInt(req.body.bet, 10);
    const choice = req.body.choice;
    const numberChoice = req.body.number != null ? parseInt(req.body.number, 10) : null;

    if (!Number.isInteger(bet) || bet < 1 || bet > 100000) return res.status(400).json({ error: 'Bet must be 1-100,000' });
    if (!['red', 'black', 'number'].includes(choice)) return res.status(400).json({ error: 'Choice must be red, black, or number' });
    if (choice === 'number' && (!Number.isInteger(numberChoice) || numberChoice < 0 || numberChoice > 36)) {
      return res.status(400).json({ error: 'Number must be 0-36' });
    }

    const user = await getUser(session.user.id, session.user.username);
    if (user.balance < bet) return res.status(400).json({ error: 'Insufficient balance' });

    await removeCoins(session.user.id, bet);
    await addToHouse(bet);

    const spin = Math.floor(Math.random() * 37);
    const spinColor = spin === 0 ? 'green' : (spin % 2 === 0 ? 'black' : 'red');

    let payout = 0;
    if (choice === 'number') {
      if (spin === numberChoice) payout = bet * 35;
    } else {
      if (spin !== 0 && spinColor === choice) payout = bet * 2;
    }
    if (payout > 0) await addCoins(session.user.id, payout);

    const updated = await getUser(session.user.id);
    res.json({ spin, spinColor, payout, bet, balance: updated.balance });
  } catch (err) { log.error('Casino roulette error:', err.message); res.status(500).json({ error: 'Internal error' }); }
});

// POST /api/casino/coinflip
dashboardApp.post('/api/casino/coinflip', async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  try {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    res.json({ result });
  } catch (err) { log.error('Casino coinflip error:', err.message); res.status(500).json({ error: 'Internal error' }); }
});

// POST /api/casino/jackpot
dashboardApp.post('/api/casino/jackpot', async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  try {
    const { getUser, removeCoins, addCoins, addToHouse } = await getEconFunctions();
    const bet = parseInt(req.body.bet, 10);
    if (!Number.isInteger(bet) || bet < 1 || bet > 100000) return res.status(400).json({ error: 'Bet must be 1-100,000' });

    const user = await getUser(session.user.id, session.user.username);
    if (user.balance < bet) return res.status(400).json({ error: 'Insufficient balance' });

    await removeCoins(session.user.id, bet);
    await addToHouse(bet);

    const roll = Math.floor(Math.random() * 10000) + 1;
    let payout = 0, tierName = 'No Win';
    if (roll === 1)          { payout = bet * 1000; tierName = 'Mega Jackpot'; }
    else if (roll <= 10)     { payout = bet * 100;  tierName = 'Big Jackpot'; }
    else if (roll <= 110)    { payout = bet * 10;   tierName = 'Big Win'; }
    else if (roll <= 1110)   { payout = bet * 2;    tierName = 'Small Win'; }

    if (payout > 0) await addCoins(session.user.id, payout);

    const updated = await getUser(session.user.id);
    res.json({ roll, tierName, payout, bet, balance: updated.balance });
  } catch (err) { log.error('Casino jackpot error:', err.message); res.status(500).json({ error: 'Internal error' }); }
});

// ─── Stock Market API routes ──────────────────────────────────────────────

async function getStockFunctions() {
  return await import('./services/stockMarket.js');
}

// GET /api/stocks/market — list all stocks with prices
dashboardApp.get('/api/stocks/market', async (req, res) => {
  try {
    const { getMarket } = await getStockFunctions();
    const stocks = await getMarket();
    res.json(stocks.map(s => ({
      ticker: s.ticker,
      name: s.name,
      price: s.price,
      volatility: s.volatility,
      history: (s.history || []).map(h => ({ price: h.price, timestamp: h.timestamp })),
      lastUpdated: s.lastUpdated,
    })));
  } catch (err) { log.error('Stocks market error:', err.message); res.status(500).json({ error: 'Internal error' }); }
});

// GET /api/stocks/portfolio — logged-in user's holdings
dashboardApp.get('/api/stocks/portfolio', async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  try {
    const { getPortfolio, getStock } = await getStockFunctions();
    const holdings = await getPortfolio(session.user.id);
    const enriched = [];
    for (const h of holdings) {
      const stock = await getStock(h.ticker);
      const currentPrice = stock ? stock.price : 0;
      enriched.push({
        ticker: h.ticker,
        quantity: h.quantity,
        buyPrice: h.buyPrice,
        currentPrice,
        value: currentPrice * h.quantity,
      });
    }
    const totalValue = enriched.reduce((s, e) => s + e.value, 0);
    res.json({ stocks: enriched, totalValue });
  } catch (err) { log.error('Stocks portfolio error:', err.message); res.status(500).json({ error: 'Internal error' }); }
});

// POST /api/stocks/buy — buy shares
dashboardApp.post('/api/stocks/buy', async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  try {
    const { buyStock } = await getStockFunctions();
    const ticker = (req.body.ticker || '').toUpperCase().trim();
    const quantity = parseInt(req.body.quantity, 10);
    if (!ticker || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Invalid ticker or quantity' });
    }
    const result = await buyStock(session.user.id, session.user.username, ticker, quantity);
    res.json({ success: true, cost: result.cost, newBalance: result.newBalance });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/stocks/sell — sell shares
dashboardApp.post('/api/stocks/sell', async (req, res) => {
  const session = requireAuth(req, res);
  if (!session) return;
  try {
    const { sellStock } = await getStockFunctions();
    const ticker = (req.body.ticker || '').toUpperCase().trim();
    const quantity = parseInt(req.body.quantity, 10);
    if (!ticker || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Invalid ticker or quantity' });
    }
    const result = await sellStock(session.user.id, ticker, quantity);
    res.json({ success: true, revenue: result.revenue, remaining: result.remaining });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Admin permission check middleware ─────────────────────────────────
const ADMIN_PERMISSION = 0x8; // ADMINISTRATOR

function requireGuildAdmin(req, res) {
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'Not logged in' }); return null; }

  const guildId = req.params.guildId;
  if (!guildId || !/^\d{17,20}$/.test(guildId)) {
    res.status(400).json({ error: 'Invalid guild ID' });
    return null;
  }

  // Verify bot is in the guild
  if (!client.guilds.cache.has(guildId)) {
    res.status(404).json({ error: 'Bot is not in this guild' });
    return null;
  }

  // Verify user has ADMINISTRATOR in this guild
  const userGuild = session.guilds.find(g => g.id === guildId);
  if (!userGuild || !(parseInt(userGuild.permissions) & ADMIN_PERMISSION)) {
    res.status(403).json({ error: 'You do not have Administrator permission in this guild' });
    return null;
  }

  return session;
}

// GET /api/admin/guilds — list guilds where user is admin and bot is present
dashboardApp.get('/api/admin/guilds', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not logged in' });

  const botGuildIds = new Set(client.guilds.cache.map(g => g.id));
  const adminGuilds = session.guilds
    .filter(g => botGuildIds.has(g.id) && (parseInt(g.permissions) & ADMIN_PERMISSION))
    .map(g => {
      const botGuild = client.guilds.cache.get(g.id);
      return {
        id: g.id,
        name: g.name,
        icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : null,
        memberCount: botGuild?.memberCount || 0,
      };
    });

  res.json(adminGuilds);
});

// ─── Guild Settings API ───────────────────────────────────────────────

// GET /api/admin/guild/:guildId/settings
dashboardApp.get('/api/admin/guild/:guildId/settings', async (req, res) => {
  if (!requireGuildAdmin(req, res)) return;
  const { guildId } = req.params;

  try {
    // Welcome config (global)
    let welcome = {};
    try {
      const welcomePath = path.join(__dirname, '..', 'config', 'welcome.json');
      welcome = JSON.parse(await fs.readFile(welcomePath, 'utf-8'));
    } catch { /* no config */ }

    // Ticket config (per-guild)
    let ticket = {};
    try {
      const ticketPath = path.join(__dirname, '..', 'data', 'ticketConfig.json');
      const allTickets = JSON.parse(await fs.readFile(ticketPath, 'utf-8'));
      ticket = allTickets[guildId] || {};
    } catch { /* no config */ }

    // Antiraid config (per-guild)
    let antiraid = {};
    try {
      const antiraidPath = path.join(__dirname, '..', 'data', 'antiraid.json');
      const allAntiraid = JSON.parse(await fs.readFile(antiraidPath, 'utf-8'));
      antiraid = allAntiraid[guildId] || {};
    } catch { /* no config */ }

    // Guild channels for dropdowns
    const guild = client.guilds.cache.get(guildId);
    const channels = guild?.channels.cache
      .filter(c => [0, 5, 11, 12, 13, 15].includes(c.type))
      .map(c => ({ id: c.id, name: c.name, type: c.type })) || [];

    const roles = guild?.roles.cache
      .filter(r => r.id !== guildId) // exclude @everyone
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor })) || [];

    res.json({ welcome, ticket, antiraid, channels, roles });
  } catch (err) {
    log.error('Guild settings fetch error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// PUT /api/admin/guild/:guildId/settings
dashboardApp.put('/api/admin/guild/:guildId/settings', async (req, res) => {
  if (!requireGuildAdmin(req, res)) return;
  const { guildId } = req.params;
  const { section, data: sectionData } = req.body;

  if (!section || !sectionData || typeof sectionData !== 'object') {
    return res.status(400).json({ error: 'Missing section or data' });
  }

  try {
    if (section === 'welcome') {
      const welcomePath = path.join(__dirname, '..', 'config', 'welcome.json');
      let existing = {};
      try { existing = JSON.parse(await fs.readFile(welcomePath, 'utf-8')); } catch {}
      const updated = { ...existing, ...sectionData };
      // Sanitize fields
      if (typeof updated.enabled !== 'boolean') updated.enabled = false;
      if (typeof updated.message !== 'string') updated.message = 'Welcome {user} to {server}!';
      updated.message = updated.message.slice(0, 500);
      await fs.writeFile(welcomePath, JSON.stringify(updated, null, 2));
      return res.json({ success: true, data: updated });
    }

    if (section === 'ticket') {
      const ticketPath = path.join(__dirname, '..', 'data', 'ticketConfig.json');
      let all = {};
      try { all = JSON.parse(await fs.readFile(ticketPath, 'utf-8')); } catch {}
      all[guildId] = { ...(all[guildId] || {}), ...sectionData };
      const allowed = ['archive', 'delete'];
      if (!allowed.includes(all[guildId].closeAction)) all[guildId].closeAction = 'archive';
      await fs.writeFile(ticketPath, JSON.stringify(all, null, 2));
      return res.json({ success: true, data: all[guildId] });
    }

    if (section === 'antiraid') {
      const antiraidPath = path.join(__dirname, '..', 'data', 'antiraid.json');
      let all = {};
      try { all = JSON.parse(await fs.readFile(antiraidPath, 'utf-8')); } catch {}
      all[guildId] = { ...(all[guildId] || {}), ...sectionData };
      await fs.writeFile(antiraidPath, JSON.stringify(all, null, 2));
      return res.json({ success: true, data: all[guildId] });
    }

    return res.status(400).json({ error: 'Unknown section' });
  } catch (err) {
    log.error('Guild settings update error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Listener Manager API ─────────────────────────────────────────────

// GET /api/admin/guild/:guildId/listeners
dashboardApp.get('/api/admin/guild/:guildId/listeners', async (req, res) => {
  if (!requireGuildAdmin(req, res)) return;

  try {
    const listenersPath = path.join(__dirname, '..', 'listeners.json');
    let listeners = {};
    try { listeners = JSON.parse(await fs.readFile(listenersPath, 'utf-8')); } catch {}

    // Provide the valid events list for the UI
    const validEvents = [
      'channelCreate','channelDelete','channelUpdate',
      'guildBanAdd','guildBanRemove',
      'guildMemberAdd','guildMemberRemove','guildMemberUpdate',
      'guildUpdate',
      'inviteCreate','inviteDelete',
      'messageCreate','messageDelete','messageDeleteBulk','messageUpdate',
      'messageReactionAdd','messageReactionRemove',
      'roleCreate','roleDelete','roleUpdate',
      'voiceStateUpdate',
      'emojiCreate','emojiDelete','emojiUpdate',
      'threadCreate','threadDelete','threadUpdate',
    ];

    res.json({ listeners, validEvents });
  } catch (err) {
    log.error('Listener fetch error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// PUT /api/admin/guild/:guildId/listeners/:event
dashboardApp.put('/api/admin/guild/:guildId/listeners/:event', async (req, res) => {
  if (!requireGuildAdmin(req, res)) return;
  const { event } = req.params;
  const { channelId, enabled } = req.body;

  if (!event || !/^[a-zA-Z]+$/.test(event)) {
    return res.status(400).json({ error: 'Invalid event name' });
  }

  try {
    const listenersPath = path.join(__dirname, '..', 'listeners.json');
    let listeners = {};
    try { listeners = JSON.parse(await fs.readFile(listenersPath, 'utf-8')); } catch {}

    if (enabled === false) {
      delete listeners[event];
    } else {
      if (!channelId || !/^\d{17,20}$/.test(channelId)) {
        return res.status(400).json({ error: 'Invalid channel ID' });
      }
      listeners[event] = {
        channelId,
        format: '[{timestamp}] {event}: {json}',
        filters: {},
        enabled: true,
      };
    }

    await fs.writeFile(listenersPath, JSON.stringify(listeners, null, 2));
    res.json({ success: true, listeners });
  } catch (err) {
    log.error('Listener update error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// DELETE /api/admin/guild/:guildId/listeners/:event
dashboardApp.delete('/api/admin/guild/:guildId/listeners/:event', async (req, res) => {
  if (!requireGuildAdmin(req, res)) return;
  const { event } = req.params;

  if (!event || !/^[a-zA-Z]+$/.test(event)) {
    return res.status(400).json({ error: 'Invalid event name' });
  }

  try {
    const listenersPath = path.join(__dirname, '..', 'listeners.json');
    let listeners = {};
    try { listeners = JSON.parse(await fs.readFile(listenersPath, 'utf-8')); } catch {}

    delete listeners[event];
    await fs.writeFile(listenersPath, JSON.stringify(listeners, null, 2));
    res.json({ success: true, listeners });
  } catch (err) {
    log.error('Listener delete error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── Warnings Viewer API ──────────────────────────────────────────────

// GET /api/admin/guild/:guildId/warnings
dashboardApp.get('/api/admin/guild/:guildId/warnings', async (req, res) => {
  if (!requireGuildAdmin(req, res)) return;
  const { guildId } = req.params;

  try {
    const warningsPath = path.join(__dirname, '..', 'warnings.json');
    let allWarnings = {};
    try { allWarnings = JSON.parse(await fs.readFile(warningsPath, 'utf-8')); } catch {}

    // Enrich warnings with username from guild member cache
    const guild = client.guilds.cache.get(guildId);
    const result = [];

    for (const [userId, warns] of Object.entries(allWarnings)) {
      if (!Array.isArray(warns) || warns.length === 0) continue;

      let username = 'Unknown User';
      try {
        const member = guild?.members.cache.get(userId);
        if (member) {
          username = member.user.tag;
        } else {
          const user = await client.users.fetch(userId).catch(() => null);
          if (user) username = user.tag;
        }
      } catch {}

      result.push({
        userId,
        username,
        warnings: warns.map((w, i) => ({
          index: i,
          timestamp: w.timestamp,
          moderator: w.moderator?.tag || 'Unknown',
          reason: w.reason,
        })),
      });
    }

    res.json(result);
  } catch (err) {
    log.error('Warnings fetch error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// DELETE /api/admin/guild/:guildId/warnings/:userId/:index
dashboardApp.delete('/api/admin/guild/:guildId/warnings/:userId/:index', async (req, res) => {
  if (!requireGuildAdmin(req, res)) return;
  const { userId, index } = req.params;
  const idx = parseInt(index, 10);

  if (!/^\d{17,20}$/.test(userId) || !Number.isInteger(idx) || idx < 0) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    const warningsPath = path.join(__dirname, '..', 'warnings.json');
    let allWarnings = {};
    try { allWarnings = JSON.parse(await fs.readFile(warningsPath, 'utf-8')); } catch {}

    if (!allWarnings[userId] || !allWarnings[userId][idx]) {
      return res.status(404).json({ error: 'Warning not found' });
    }

    allWarnings[userId].splice(idx, 1);
    if (allWarnings[userId].length === 0) delete allWarnings[userId];

    await fs.writeFile(warningsPath, JSON.stringify(allWarnings, null, 2));
    res.json({ success: true });
  } catch (err) {
    log.error('Warning delete error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

dashboardApp.use(express.static(dashboardDir));

dashboardApp.listen(DASHBOARD_PORT, '0.0.0.0', () => {
  log.info(`Dashboard running on http://0.0.0.0:${DASHBOARD_PORT}`);
});

// Launch bot
bootstrap().catch(err => {
  log.err(err, 'Bootstrap failed');
  process.exit(1);
});