// src/commands/moderation/unmute.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('unmute')
  .setDescription('Remove timeout from a member')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Member to unmute')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for unmute')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const target = interaction.options.getMember('target');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  if (!target) {
    return interaction.reply({ content: 'Could not find that member.', ephemeral: true });
  }

  if (!target.isCommunicationDisabled()) {
    return interaction.reply({ content: 'This member is not timed out.', ephemeral: true });
  }

  try {
    await target.timeout(null, reason);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Member Unmuted')
      .setDescription(`${target.user.tag} is no longer timed out.`)
      .addFields(
        { name: 'Reason', value: reason, inline: true },
        { name: 'Moderator', value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: 'Failed to unmute member. Check permissions.', ephemeral: true });
  }
}