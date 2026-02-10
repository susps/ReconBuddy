// src/commands/utility/test.js   (or adjust path if different)

import { SlashCommandBuilder } from '@discordjs/builders';

export const data = new SlashCommandBuilder()
  .setName('test')
  .setDescription('Simple test command to check if deployment works');

export async function execute(interaction) {
  await interaction.reply({
    content: 'Test command works! Bot is responding to slash commands.',
    ephemeral: true,
  }).catch(() => { });
}