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

dashboardApp.use(express.static(dashboardDir));

dashboardApp.listen(DASHBOARD_PORT, '0.0.0.0', () => {
  log.info(`Dashboard running on http://0.0.0.0:${DASHBOARD_PORT}`);
});

// Launch bot
bootstrap().catch(err => {
  log.err(err, 'Bootstrap failed');
  process.exit(1);
});