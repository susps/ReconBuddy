// src/commands/economy/work.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { work } from '../../services/economy.js';

export const data = new SlashCommandBuilder()
  .setName('work')
  .setDescription('Work for some NEXI Coins (30-minute cooldown)');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const earned = await work(interaction.user.id, interaction.user.username);  // ← pass username

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Work Complete!')
      .setDescription(`You earned **${earned.toLocaleString()}** NEXI Coins!`)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 512 }))
      .setTimestamp()
      .setFooter({ text: `Worked by ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({ content: err.message, ephemeral: true });
  }
}