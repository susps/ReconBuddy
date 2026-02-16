// src/commands/utility/stats.js
import { SlashCommandBuilder, EmbedBuilder, version } from 'discord.js';
import os from 'node:os';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Shows bot statistics and monitoring info');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const client = interaction.client;

  // Uptime
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor(uptime / 3600) % 24;
  const minutes = Math.floor(uptime / 60) % 60;
  const seconds = Math.floor(uptime % 60);
  const formattedUptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;

  // Memory
  const memoryUsage = process.memoryUsage();
  const heapUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
  const heapTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);

  // CPU
  const cpus = os.cpus();
  const cpuModel = cpus[0].model;
  const cpuCores = cpus.length;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Bot Statistics')
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      { name: '🖥️ Servers', value: client.guilds.cache.size.toString(), inline: true },
      { name: '👥 Users', value: client.users.cache.size.toString(), inline: true },
      { name: '🛠️ Commands Loaded', value: client.commands.size.toString(), inline: true },
      { name: '🕒 Uptime', value: formattedUptime, inline: true },
      { name: '🧠 Memory Usage', value: `${heapUsed} / ${heapTotal} MB`, inline: true },
      { name: '📡 Discord.js Version', value: `v${version}`, inline: true },
      { name: '🔄 Node.js Version', value: process.version, inline: true },
      { name: '🖥️ OS', value: `${os.type()} ${os.release()}`, inline: true },
      { name: '💻 CPU', value: `${cpuCores} cores (${cpuModel})`, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}` });

  await interaction.editReply({ embeds: [embed] });
}