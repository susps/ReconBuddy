// src/index.js
import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// discord.js – default import + direct access (the only stable ESM pattern for v14)
import discord from 'discord.js';

import { MongoClient, ServerApiVersion } from 'mongodb';

import { loadComponents } from './handlers/componentHandler.js';

// ─────────────────────────────────────────────────────────────────────────────
// Paths & environment
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOKEN = process.env.DISCORD_TOKEN?.trim();

if (!TOKEN) {
  console.error('DISCORD_TOKEN is missing or empty in .env');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Client setup
// ─────────────────────────────────────────────────────────────────────────────

const client = new discord.Client({
  intents: [
    discord.IntentsBitField.Flags.Guilds,
    discord.IntentsBitField.Flags.GuildMembers,
    discord.IntentsBitField.Flags.GuildPresences,
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
        console.warn(`Invalid event file: ${file}`);
        continue;
      }

      const register = event.once ? client.once : client.on;
      register.call(client, event.name, (...args) => event.execute(...args, client));

      console.log(`[EVENT] Loaded → ${event.name}${event.once ? ' (once)' : ''}`);
      count++;
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('events/ directory not found – skipping');
    } else {
      console.error('Failed to load events:', err.message);
    }
  }

  return count;
}

async function loadCommands() {
  const commandsDir = path.join(__dirname, 'commands');
  let count = 0;

  try {
    const items = await fs.readdir(commandsDir);
    console.log(`DEBUG: Raw items in commands/: ${items.join(', ')}`);

    const categories = [];

    for (const item of items) {
      const itemPath = path.join(commandsDir, item);
      const stat = await fs.stat(itemPath);

      if (stat.isDirectory()) {
        categories.push(item);
        console.log(`DEBUG: Directory found: ${item}`);
      } else {
        console.log(`DEBUG: File skipped (not directory): ${item}`);
      }
    }

    for (const category of categories) {
      const catPath = path.join(commandsDir, category);
      const files = (await fs.readdir(catPath)).filter(f => f.endsWith('.js') || f.endsWith('.mjs'));

      console.log(`DEBUG: Category "${category}" has files: ${files.join(', ') || '(empty)'}`);

      for (const file of files) {
        const filePath = path.join(catPath, file);
        const fileUrl = pathToFileURL(filePath).href;

        try {
          const command = await import(fileUrl);

          if (!command?.data?.name || typeof command.execute !== 'function') {
            console.warn(`Invalid command: ${path.join(category, file)}`);
            continue;
          }

          client.commands.set(command.data.name, command);
          console.log(`[CMD] Loaded → /${command.data.name} (${category})`);
          count++;
        } catch (err) {
          console.error(`Failed to load ${path.join(category, file)}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load commands folder:', err);
  }

  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Database (optional)
// ─────────────────────────────────────────────────────────────────────────────

async function initDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI?.trim();

  if (!MONGODB_URI) {
    console.warn('No MONGODB_URI provided – database disabled');
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
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    client.db = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Startup sequence
// ─────────────────────────────────────────────────────────────────────────────

async function bootstrap() {
  console.log('Starting bot...');

  const eventsLoaded = await loadEvents();
  const commandsLoaded = await loadCommands();

  await initDatabase();

  await loadComponents(client);

  console.log(`\nReady: ${eventsLoaded} events • ${commandsLoaded} commands`);

  client.login(TOKEN).catch(err => {
    console.error('Login failed:', err.message);
    process.exit(1);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Global error handling
// ─────────────────────────────────────────────────────────────────────────────

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]', promise, reason);
});

process.on('uncaughtException', err => {
  console.error('[Uncaught Exception]', err);
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Launch
// ─────────────────────────────────────────────────────────────────────────────

bootstrap().catch(err => {
  console.error('Bootstrap failed:', err.message);
  process.exit(1);
});