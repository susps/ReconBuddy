// src/commands/moderation/clear.js
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Delete multiple messages in the channel')
  .addIntegerOption(option =>
    option.setName('amount')
      .setDescription('Number of messages to delete (2-100)')
      .setMinValue(2)
      .setMaxValue(100)
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false);

export async function execute(interaction) {
  const amount = interaction.options.getInteger('amount', true);

  if (amount < 2 || amount > 100) {
    return interaction.reply({ content: 'Amount must be between 2 and 100.', ephemeral: true });
  }

  try {
    const messages = await interaction.channel.bulkDelete(amount, true);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Messages Cleared')
      .setDescription(`Deleted **${messages.size}** messages.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: 'Failed to delete messages (older than 14 days or missing perms).', ephemeral: true });
  }
}