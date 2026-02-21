// src/commands/economy/daily.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { claimDaily } from '../../services/economy.js';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily NEXI Coins reward');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await claimDaily(interaction.user.id, interaction.user.username);
    const { reward, streak, multiplier } = result;

    let streakText = '';
    if (streak > 1) {
      streakText = `\n🔥 **Streak: ${streak} days** (${(multiplier * 100).toFixed(0)}% bonus)`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Daily Reward Claimed!')
      .setDescription(`You received **${reward.toLocaleString()}** NEXI Coins!${streakText}`)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 512 }))
      .setTimestamp()
      .setFooter({ text: `Claimed by ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({ content: err.message, ephemeral: true });
  }
}