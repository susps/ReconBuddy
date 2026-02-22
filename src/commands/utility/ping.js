// src/commands/utility/ping.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Checks the bot\'s latency and response time');

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 });

  const sent = await interaction.editReply({
    content: 'Pinging...',
    fetchReply: true,
  });

  const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
  const wsPing = interaction.client.ws.ping;

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('Pong! 🏓')
    .addFields(
      { name: 'Roundtrip Latency', value: `${roundtrip}ms`, inline: true },
      { name: 'Websocket Heartbeat', value: `${wsPing}ms`, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}` });

  await interaction.editReply({ embeds: [embed], content: null });
}