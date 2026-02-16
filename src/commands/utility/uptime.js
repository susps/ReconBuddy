// src/commands/utility/uptime.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('uptime')
  .setDescription('Shows how long the bot has been running');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor(uptime / 3600) % 24;
  const minutes = Math.floor(uptime / 60) % 60;
  const seconds = Math.floor(uptime % 60);

  const formatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Bot Uptime')
    .setDescription(`The bot has been running for **${formatted}**.`)
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}` });

  await interaction.editReply({ embeds: [embed] });
}