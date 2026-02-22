// src/commands/moderation/slowmode.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Set slowmode in the current channel')
  .addIntegerOption(option =>
    option.setName('seconds')
      .setDescription('Seconds between messages (0 to disable)')
      .setMinValue(0)
      .setMaxValue(21600) // Discord max = 6 hours
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false);

export async function execute(interaction) {
  const seconds = interaction.options.getInteger('seconds', true);

  try {
    await interaction.channel.setRateLimitPerUser(seconds);

    const status = seconds === 0 ? 'disabled' : `set to ${seconds} seconds`;
    const embed = new EmbedBuilder()
      .setColor(seconds === 0 ? 0x57f287 : 0xffaa00)
      .setTitle('Slowmode Updated')
      .setDescription(`Slowmode in this channel has been ${status}.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: 'Failed to set slowmode (missing permissions).', flags: 64 });
  }
}