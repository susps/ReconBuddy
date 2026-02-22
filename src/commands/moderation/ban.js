// src/commands/moderation/ban.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a member from the server')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('User to ban')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for ban')
      .setRequired(false)
  )
  .addIntegerOption(option =>
    option.setName('days')
      .setDescription('Days of messages to delete (0-7)')
      .setMinValue(0)
      .setMaxValue(7)
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const target = interaction.options.getUser('target', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const deleteDays = interaction.options.getInteger('days') || 0;

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (member && !member.bannable) {
    return interaction.reply({ content: 'I cannot ban this user (higher role or missing perms).', flags: 64 });
  }

  try {
    await interaction.guild.bans.create(target.id, {
      reason,
      deleteMessageDays: deleteDays,
    });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('Member Banned')
      .setDescription(`${target.tag} has been banned.`)
      .addFields(
        { name: 'Reason', value: reason, inline: true },
        { name: 'Messages deleted', value: deleteDays ? `${deleteDays} days` : 'None', inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: 'Failed to ban member. Check permissions.', flags: 64 });
  }
}