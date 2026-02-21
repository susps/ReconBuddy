// src/events/ready.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getGuildConfig } from '../services/ticket.js';
import { cacheInvites } from '../services/inviteTracker.js';

import { startPriceUpdates } from '../services/stockMarket.js';

export const name = 'clientReady';
export const once = true;

/**
 * @param {import('discord.js').Client} client
 */
export async function execute(client) {
  console.log(`[READY] Logged in as ${client.user.tag} (${client.user.id})`);
  console.log(`[READY] Serving ${client.guilds.cache.size} guilds • ${client.users.cache.size} users`);
  startPriceUpdates();
  console.log('[READY] Stock market price updates started');
  const { startStatusRotation } = await import('../utils/statusRotator.js');

  const config = getGuildConfig('YOUR_GUILD_ID_HERE'); // or load from DB
  const supportChannel = await client.channels.fetch(config.supportChannelId).catch(() => null);
  if (supportChannel && supportChannel.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Support Tickets')
      .setDescription('Click the button below to create a new ticket.');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket_button')
        .setLabel('Create Ticket')
        .setStyle(ButtonStyle.Primary)
    );

    await supportChannel.send({ embeds: [embed], components: [row] }).catch(err => console.error('Failed to send persistent button:', err));
  }

  client.guilds.cache.forEach(guild => cacheInvites(guild));
  startStatusRotation(client);
}