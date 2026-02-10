import discord from 'discord.js';

export const data = new discord.SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong!');

export async function execute(interaction) {
  await interaction.reply('Pong!');
}