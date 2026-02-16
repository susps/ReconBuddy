// clear-commands.js
// Script to delete all registered slash commands (global or guild)
// Run with: node clear-commands.js

import dotenv from 'dotenv';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || null; // Set for guild commands, null for global

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log(`Clearing ${GUILD_ID ? 'guild' : 'global'} commands...`);

    let data;

    if (GUILD_ID) {
      data = await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: [] }
      );
    } else {
      data = await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: [] }
      );
    }

    console.log('Successfully cleared all commands.');
  } catch (error) {
    console.error('Clear failed:', error);
  }
})();