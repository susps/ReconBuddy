// src/commands/utility/invitestats.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getInviteStatsEmbed } from '../../services/inviteTracker.js';

export const data = new SlashCommandBuilder()
  .setName('invitestats')
  .setDescription('View invite leaderboard and stats for this server');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: false });

  const guildId = interaction.guild.id;

  const embed = getInviteStatsEmbed(guildId);

  await interaction.editReply({ embeds: [embed] });
}