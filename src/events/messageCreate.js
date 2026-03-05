// src/events/messageCreate.js
import { Events, EmbedBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { checkMessageRateLimit } from '../services/antiSpam.js';
import { dispatchEvent } from '../utils/eventDispatcher.js';

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message, client) {
  if (message.author.bot || !message.guild) return;

  const actionTaken = checkMessageRateLimit(message);

  if (actionTaken) {
    console.log(`Anti-spam action taken on ${message.author.tag} in ${message.guild.name}`);
  }

  // Log event
  await dispatchEvent('messageCreate', { message }, client);

  // Load listener config
  const listenersFile = path.join(process.cwd(), 'listeners.json');
  if (!fs.existsSync(listenersFile)) return;

  let listeners;
  try {
    listeners = JSON.parse(fs.readFileSync(listenersFile, 'utf-8'));
  } catch {
    return;
  }

  const listener = listeners['messageCreate'];
  if (!listener || !listener.enabled) return;

  const channel = await client.channels.fetch(listener.channelId).catch(() => null);
  if (!channel) return;

  // Check filters (simple example)
  const filters = listener.filters || {};
  let matched = false;

  if (filters.contains && message.content.includes(filters.contains.text)) {
    matched = true;
  }

  // Add more filter checks here (user ID, emoji, etc.)

  if (matched) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Message Create Event')
      .setDescription(`**User:** ${message.author.tag}\n**Content:** ${message.content}`)
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch(console.error);
  }
}