// src/botClient.js
import discord from 'discord.js';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import { log } from './utils/logger.js';
import { loadComponents } from './handlers/componentHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

client.commands = new discord.Collection();
client.cooldowns = new discord.Collection();
client.db = null;

export default client;
