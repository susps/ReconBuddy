// src/services/ticket.js
import { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Config file for ticket settings (per guild)
const CONFIG_FILE = path.join(process.cwd(), 'data/ticketConfig.json');

let ticketConfig = {};

// Load config on startup
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    ticketConfig = JSON.parse(data);
  } catch {
    ticketConfig = {};
  }
}

// Save config
async function saveConfig() {
  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(ticketConfig, null, 2));
}

// Get config for guild (defaults)
export function getGuildConfig(guildId) {
  return ticketConfig[guildId] || {
    supportChannelId: null,  // where persistent button is sent
    ticketCategoryId: null,  // parent category for ticket channels
    staffRoleId: null,       // role that can see/manage tickets
    logChannelId: null,      // where transcripts are sent
    closeAction: 'delete',   // 'delete' or 'archive'
  };
}

// Update config
export async function updateGuildConfig(guildId, newConfig) {
  ticketConfig[guildId] = { ...getGuildConfig(guildId), ...newConfig };
  await saveConfig();
}

// Create ticket channel
export async function createTicket(interaction) {
  const config = getGuildConfig(interaction.guildId);
  if (!config.staffRoleId) {
    return null; // not configured
  }

  const user = interaction.user;

  const ticketChannel = await interaction.guild.channels.create({
    name: `ticket-${user.username}`,
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId || null,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: config.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
      { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ],
  }).catch(err => {
    console.error('Failed to create ticket channel:', err);
    return null;
  });

  if (!ticketChannel) return null;

  // Welcome message in ticket
  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Ticket for ${user.tag}`)
    .setDescription('Staff will be with you shortly. Please describe your issue.')
    .setTimestamp();

  const closeBtn = new ButtonBuilder()
    .setCustomId('close_ticket')
    .setLabel('Close Ticket')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(closeBtn);

  await ticketChannel.send({ embeds: [welcomeEmbed], components: [row] });

  return ticketChannel;
}

// Close ticket
export async function closeTicket(interaction, config) {
  const channel = interaction.channel;

  if (!channel.name.startsWith('ticket-')) {
    return interaction.reply({ content: 'This can only be used in ticket channels.', ephemeral: true });
  }

  // Send message using followUp (since deferred, can't reply/update again)
  await interaction.followUp({ content: 'Closing ticket in 5 seconds...', ephemeral: true }).catch(() => {});

  setTimeout(async () => {
    if (config.logChannelId) {
      // Transcript
      const messages = await channel.messages.fetch({ limit: 100 });
      let transcript = messages.reverse().map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content || '(attachment/embed)'}`).join('\n');

      const logChannel = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);
      if (logChannel) {
        logChannel.send({
          content: `Transcript from closed ticket ${channel.name}`,
          files: [{
            attachment: Buffer.from(transcript),
            name: `transcript-${channel.name}.txt`,
          }],
        }).catch(() => {});
      }
    }

    if (config.closeAction === 'delete') {
      await channel.delete('Ticket closed by user').catch(err => console.error('Failed to delete ticket:', err));
    } else if (config.closeAction === 'archive') {
      await channel.setArchived(true, 'Ticket closed').catch(err => console.error('Failed to archive ticket:', err));
    }
  }, 5000);
}