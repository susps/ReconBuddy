// src/commands/economy/leaderboard.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../../models/User.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Top 10 richest users in the server');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: false });

  try {
    const users = await User.find({})
      .sort({ balance: -1 })
      .limit(10);

    if (users.length === 0) {
      return interaction.editReply({ content: 'No users have NEXI Coins yet.' });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🏆 NEXI Coin Leaderboard')
      .setDescription('Top 10 richest users in this server')
      .setTimestamp();

    users.forEach((user, index) => {
      embed.addFields({
        name: `#${index + 1} • ${user.username}`,
        value: `${user.balance.toLocaleString()} NEXI Coins`,
        inline: false,
      });
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Leaderboard error:', err);
    await interaction.editReply({ content: 'Failed to fetch leaderboard.', ephemeral: true });
  }
}