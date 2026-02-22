// src/commands/moderation/setuplistener.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

const validEvents = [
  'applicationCommandPermissionsUpdate',
  'autoModerationActionExecution',
  'autoModerationRuleCreate',
  'autoModerationRuleDelete',
  'autoModerationRuleUpdate',
  'channelCreate',
  'channelDelete',
  'channelPinsUpdate',
  'channelUpdate',
  'clientReady',
  'debug',
  'emojiCreate',
  'emojiDelete',
  'emojiUpdate',
  'entitlementCreate',
  'entitlementDelete',
  'entitlementUpdate',
  'error',
  'guildAuditLogEntryCreate',
  'guildAvailable',
  'guildBanAdd',
  'guildBanRemove',
  'guildCreate',
  'guildDelete',
  'guildIntegrationsUpdate',
  'guildMemberAdd',
  'guildMemberAvailable',
  'guildMemberRemove',
  'guildMembersChunk',
  'guildMemberUpdate',
  'guildScheduledEventCreate',
  'guildScheduledEventDelete',
  'guildScheduledEventUpdate',
  'guildScheduledEventUserAdd',
  'guildScheduledEventUserRemove',
  'guildUnavailable',
  'guildUpdate',
  'interactionCreate',
  'inviteCreate',
  'inviteDelete',
  'messageCreate',
  'messageDelete',
  'messageDeleteBulk',
  'messageReactionAdd',
  'messageReactionRemove',
  'messageReactionRemoveAll',
  'messageReactionRemoveEmoji',
  'messageUpdate',
  'presenceUpdate',
  'ready',
  'roleCreate',
  'roleDelete',
  'roleUpdate',
  'threadCreate',
  'threadDelete',
  'threadListSync',
  'threadMembersUpdate',
  'threadMemberUpdate',
  'threadUpdate',
  'typingStart',
  'userUpdate',
  'voiceStateUpdate',
  'warn',
  'webhooksUpdate',
];

export const data = new SlashCommandBuilder()
  .setName('setuplistener')
  .setDescription('Configure or disable event logging (Admin only)')
  .addStringOption(option =>
    option
      .setName('event')
      .setDescription('Event to monitor')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Channel to send logs to')
      .addChannelTypes(0, 5, 11, 12, 13, 15)
      .setRequired(true)
  )
  .addBooleanOption(option =>
    option
      .setName('enable')
      .setDescription('Turn listener on/off')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export async function execute(interaction) {
  const eventName = interaction.options.getString('event', true);
  const logChannel = interaction.options.getChannel('channel', true);
  const enable = interaction.options.getBoolean('enable') ?? true;

  if (!validEvents.includes(eventName)) {
    return interaction.reply({ content: 'Invalid event selected.', flags: 64 });
  }

  if (![0, 5, 11, 12, 13, 15].includes(logChannel.type)) {
    return interaction.reply({ content: 'Please select a text-based channel.', flags: 64 });
  }

  const listenersFile = path.join(process.cwd(), 'listeners.json');
  let listeners = {};

  if (fs.existsSync(listenersFile)) {
    try {
      listeners = JSON.parse(fs.readFileSync(listenersFile, 'utf-8'));
    } catch {}
  }

  if (enable) {
    listeners[eventName] = {
      channelId: logChannel.id,
      format: '[{timestamp}] {event}: {json}',
      filters: {},
      enabled: true,
    };
  } else {
    delete listeners[eventName];
  }

  try {
    fs.writeFileSync(listenersFile, JSON.stringify(listeners, null, 2));
  } catch (err) {
    console.error('Failed to save listener config:', err);
    return interaction.reply({ content: 'Failed to save configuration.', flags: 64 });
  }

  const embed = new EmbedBuilder()
    .setColor(enable ? 0x57f287 : 0xed4245)
    .setTitle(`Listener • ${eventName}`)
    .setDescription(
      enable
        ? `Logging is now **enabled** in ${logChannel}.\n\nClick below to configure filters.`
        : `Logging for **${eventName}** has been **disabled**.`
    )
    .addFields(
      { name: 'Channel', value: `${logChannel}`, inline: true },
      { name: 'Status', value: enable ? 'Enabled' : 'Disabled', inline: true },
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`listener_configure_${eventName}`)
      .setLabel('Configure Filters')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!enable)
  );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    flags: 64,
  });
}

export async function autocomplete(interaction) {
  const focused = interaction.options.getFocused(true);

  if (focused.name === 'event') {
    const search = focused.value.toLowerCase();
    const filtered = validEvents
      .filter(e => e.toLowerCase().includes(search))
      .slice(0, 25);

    await interaction.respond(
      filtered.map(event => ({ name: event, value: event }))
    );
  }
}