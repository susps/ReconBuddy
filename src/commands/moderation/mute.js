// src/commands/moderation/mute.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Mute a member for a specified duration')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Member to mute')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('duration')
      .setDescription('Duration (e.g. 30m, 2h, 1d)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for mute')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

export async function execute(interaction) {
  const target = interaction.options.getMember('target');
  const durationStr = interaction.options.getString('duration', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  if (!target) {
    return interaction.reply({ content: 'Could not find that member.', ephemeral: true });
  }

  if (target.id === interaction.user.id) {
    return interaction.reply({ content: 'You cannot mute yourself.', ephemeral: true });
  }

  if (target.user.bot) {
    return interaction.reply({ content: 'Cannot mute bots with this command.', ephemeral: true });
  }

  if (!target.manageable) {
    return interaction.reply({ content: 'I cannot mute this member (higher role or missing perms).', ephemeral: true });
  }

  // Simple duration parser (you can use ms library if installed)
  const durationMs = parseDuration(durationStr);
  if (!durationMs || durationMs <= 0) {
    return interaction.reply({ content: 'Invalid duration format. Examples: 30m, 2h, 1d', ephemeral: true });
  }

  try {
    await target.timeout(durationMs, reason);

    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('Member Muted')
      .setDescription(`${target.user.tag} has been muted.`)
      .addFields(
        { name: 'Duration', value: durationStr, inline: true },
        { name: 'Reason', value: reason, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: 'Failed to mute member. Check permissions.', ephemeral: true });
  }
}

// Very basic duration parser (seconds, minutes, hours, days)
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