// src/commands/moderation/warnlist.js
import { SlashCommandBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('warnlist')
  .setDescription('View a user\'s warnings')
  .addUserOption(option =>
    option
      .setName('target')
      .setDescription('User to check')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const target = interaction.options.getUser('target', true);

  const file = path.join(process.cwd(), 'warnings.json');
  if (!fs.existsSync(file)) {
    return interaction.reply({ content: 'No warnings have been issued yet.', flags: 64 });
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return interaction.reply({ content: 'Failed to read warnings database.', flags: 64 });
  }

  const warns = data[target.id] || [];

  if (warns.length === 0) {
    return interaction.reply({ content: `${target.tag} has no warnings.`, flags: 64 });
  }

  let description = `Warnings for **${target.tag}** (${target.id}):\n\n`;
  warns.forEach((w, i) => {
    description += `**#${i + 1}** — ${w.timestamp.slice(0, 10)}\n`;
    description += `Moderator: ${w.moderator.tag}\n`;
    description += `Reason: ${w.reason}\n\n`;
  });

  return interaction.reply({ embeds: [{ description }], flags: 64 });
}