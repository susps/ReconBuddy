// src/commands/support/ticketSetup.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import { updateGuildConfig } from '../../services/ticket.js';
import { getGuildConfig } from '../../services/ticket.js';

export const data = new SlashCommandBuilder()
  .setName('ticketsetup')
  .setDescription('Configure ticket system (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)

  .addChannelOption(option =>
    option
      .setName('supportchannel')
      .setDescription('Channel for persistent ticket button')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  )
  .addChannelOption(option =>
    option
      .setName('category')
      .setDescription('Category for new ticket channels')
      .addChannelTypes(ChannelType.GuildCategory)
      .setRequired(false)
  )
  .addRoleOption(option =>
    option
      .setName('staffrole')
      .setDescription('Role for staff who can manage tickets')
      .setRequired(false)
  )
  .addChannelOption(option =>
    option
      .setName('logchannel')
      .setDescription('Channel for ticket transcripts')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('closeaction')
      .setDescription('What to do when closing a ticket')
      .addChoices({ name: 'Delete', value: 'delete' }, { name: 'Archive', value: 'archive' })
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guild.id;
  let config = getGuildConfig(guildId);

  const supportChannel = interaction.options.getChannel('supportchannel');
  const category = interaction.options.getChannel('category');
  const staffRole = interaction.options.getRole('staffrole');
  const logChannel = interaction.options.getChannel('logchannel');
  const closeAction = interaction.options.getString('closeaction');

  if (supportChannel) config.supportChannelId = supportChannel.id;
  if (category) config.ticketCategoryId = category.id;
  if (staffRole) config.staffRoleId = staffRole.id;
  if (logChannel) config.logChannelId = logChannel.id;
  if (closeAction) config.closeAction = closeAction;

  await updateGuildConfig(guildId, config);

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('Ticket System Configuration Updated')
    .addFields(
      { name: 'Support Channel', value: config.supportChannelId ? `<#${config.supportChannelId}>` : 'Not set', inline: true },
      { name: 'Ticket Category', value: config.ticketCategoryId ? `<#${config.ticketCategoryId}>` : 'Not set', inline: true },
      { name: 'Staff Role', value: config.staffRoleId ? `<@&${config.staffRoleId}>` : 'Not set', inline: true },
      { name: 'Log Channel', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not set', inline: true },
      { name: 'Close Action', value: config.closeAction || 'delete', inline: true }
    );

  await interaction.editReply({ embeds: [embed] });
}