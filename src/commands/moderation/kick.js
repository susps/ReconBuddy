// src/commands/moderation/kick.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a member from the server')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Member to kick')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for kick')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const target = interaction.options.getMember('target');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  if (!target) {
    return interaction.reply({ content: 'Could not find that member.', flags: 64 });
  }

  if (target.id === interaction.user.id) {
    return interaction.reply({ content: 'You cannot kick yourself.', flags: 64 });
  }

  if (!target.kickable) {
    return interaction.reply({ content: 'I cannot kick this member (higher role or missing perms).', flags: 64 });
  }

  try {
    await target.kick(reason);

    const embed = new EmbedBuilder()
      .setColor(0xff5555)
      .setTitle('Member Kicked')
      .setDescription(`${target.user.tag} has been kicked from the server.`)
      .addFields(
        { name: 'Reason', value: reason, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: 'Failed to kick member. Check permissions.', flags: 64 });
  }
}