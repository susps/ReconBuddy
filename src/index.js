// src/index.js
import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// discord.js – default import + direct access (stable ESM pattern)
// ─────────────────────────────────────────────────────────────────────────────
import discord from 'discord.js';

import { MongoClient, ServerApiVersion } from 'mongodb';

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
    discord.IntentsBitField.Flags.GuildVoiceStates,
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
client.db = null;

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
// Database (optional)
// ─────────────────────────────────────────────────────────────────────────────

async function initDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI?.trim();

  if (!MONGODB_URI) {
    log.warn('No MONGODB_URI provided – database disabled');
    return;
  }

  try {
    const mongo = new MongoClient(MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    await mongo.connect();
    await mongo.db().command({ ping: 1 });

    client.db = mongo.db();
    log.info('MongoDB connected');
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

  // Start status rotation (after login)
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
// Launch
// ─────────────────────────────────────────────────────────────────────────────

bootstrap().catch(err => {
  log.err(err, 'Bootstrap failed');
  process.exit(1);
});