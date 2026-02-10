// scripts/deploy-commands.js
/**
 * Discord slash command deployment script
 * Works with discord.js v14+ and ESM projects
 *
 * Required packages:
 *   npm install @discordjs/rest discord-api-types
 *
 * Required .env variables:
 *   DISCORD_TOKEN
 *   CLIENT_ID
 *   GUILD_ID     (optional – for instant guild updates)
 *
 * Run: npm run deploy   or   node scripts/deploy-commands.js
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
//  Correct imports for discord.js v14+ (separate REST package)
// ─────────────────────────────────────────────────────────────────────────────

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10'; // use v10, v11 or v9 depending on your version

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
//  Environment & validation
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN = process.env.DISCORD_TOKEN?.trim();
const CLIENT_ID = process.env.CLIENT_ID?.trim();
const GUILD_ID = process.env.GUILD_ID?.trim() || '';

if (!TOKEN) {
  console.error('DISCORD_TOKEN is missing or empty in .env');
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error('CLIENT_ID is missing or empty in .env');
  process.exit(1);
}

console.log(`Deploying commands for application ${CLIENT_ID}`);
console.log(
  GUILD_ID
    ? `→ Guild-specific deployment (${GUILD_ID}) – updates instantly`
    : '→ Global deployment – may take up to 1 hour to appear'
);

// ─────────────────────────────────────────────────────────────────────────────
//  Collect all slash commands recursively
// ─────────────────────────────────────────────────────────────────────────────

const commands = [];
const commandsRoot = path.join(__dirname, '..', 'src', 'commands');

async function collectCommands(currentDir) {
  let count = 0;

  try {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        count += await collectCommands(fullPath);
        continue;
      }

      if (!entry.name.endsWith('.js') && !entry.name.endsWith('.mjs')) {
        continue;
      }

      try {
        const fileUrl = pathToFileURL(fullPath).href;
        const module = await import(fileUrl);

        if (!module?.data) {
          console.warn(`  Skipping ${entry.name} — missing 'data' export`);
          continue;
        }

        const dataJson = module.data.toJSON?.() ?? module.data;

        if (!dataJson?.name) {
          console.warn(`  Skipping ${entry.name} — data missing 'name'`);
          continue;
        }

        commands.push(dataJson);
        count++;
        console.log(`  → Collected /${dataJson.name}`);
      } catch (err) {
        console.error(`  Failed to load ${entry.name}:`);
        console.error(`    ${err.message}`);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Error reading directory ${currentDir}:`, err.message);
    }
  }

  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main execution
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\nScanning for commands...');

  const total = await collectCommands(commandsRoot);

  console.log(`\nTotal commands collected: ${total}`);

  if (total === 0) {
    console.error('No valid commands found. Aborting.');
    process.exit(1);
  }

  console.log('Deploying commands...');

  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);

    let response;

    if (GUILD_ID) {
      response = await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
    } else {
      response = await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
    }

    console.log(`\nSuccess! Registered ${response.length} command(s).`);
    console.log('Deployment finished.');
  } catch (error) {
    console.error('Deployment failed:');
    console.error(error);

    if (error.code === 401) {
      console.error(' → Invalid or expired token');
    } else if (error.code === 50001) {
      console.error(' → Bot is not in the guild (for guild deployment)');
    } else if (error.code === 403) {
      console.error(' → Missing applications.commands scope');
    }

    process.exit(1);
  }
})();