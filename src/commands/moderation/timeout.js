// src/commands/moderation/timeout.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Time out a member')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Member to timeout')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('duration')
      .setDescription('Duration (e.g. 30m, 2h, 1d)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for timeout')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const target = interaction.options.getMember('target');
  const durationStr = interaction.options.getString('duration', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  if (!target) {
    return interaction.reply({ content: 'Could not find that member.', flags: 64 });
  }

  if (target.id === interaction.user.id) {
    return interaction.reply({ content: 'You cannot timeout yourself.', flags: 64 });
  }

  if (target.user.bot) {
    return interaction.reply({ content: 'Cannot timeout bots with this command.', flags: 64 });
  }

  if (!target.manageable) {
    return interaction.reply({ content: 'I cannot timeout this member.', flags: 64 });
  }

  const durationMs = parseDuration(durationStr);
  if (!durationMs || durationMs <= 0 || durationMs > 28 * 24 * 60 * 60 * 1000) {
    return interaction.reply({ content: 'Duration must be between 1 second and 28 days. Examples: 30m, 2h, 1d', flags: 64 });
  }

  try {
    await target.timeout(durationMs, reason);

    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('Member Timed Out')
      .setDescription(`${target.user.tag} has been timed out.`)
      .addFields(
        { name: 'Duration', value: durationStr, inline: true },
        { name: 'Reason', value: reason, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: 'Failed to timeout member. Check permissions.', flags: 64 });
  }
}

// Basic duration parser
function parseDuration(str) {
  const regex = /^(\d+)([smhd])$/i;
  const match = str.match(regex);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}