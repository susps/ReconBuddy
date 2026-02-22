// src/commands/moderation/warn.js
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

const MAX_WARNINGS = 3;

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Issue a warning to a user')
  .addUserOption(option =>
    option
      .setName('target')
      .setDescription('User to warn')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for the warning')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false);

export async function execute(interaction) {
  const target = interaction.options.getUser('target', true);
  const reason = interaction.options.getString('reason', true);

  if (target.id === interaction.user.id) {
    return interaction.reply({ content: 'You cannot warn yourself.', flags: 64 });
  }

  if (target.bot) {
    return interaction.reply({ content: 'You cannot warn bots.', flags: 64 });
  }

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (member && !member.manageable) {
    return interaction.reply({ content: 'I cannot warn this user (higher role / missing perms).', flags: 64 });
  }

  const file = path.join(process.cwd(), 'warnings.json');
  let data = {};

  if (fs.existsSync(file)) {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {}
  }

  if (!data[target.id]) data[target.id] = [];

  const warning = {
    timestamp: new Date().toISOString(),
    moderator: { tag: interaction.user.tag, id: interaction.user.id },
    reason,
  };

  data[target.id].push(warning);

  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save warning:', err);
    return interaction.reply({ content: 'Failed to save warning.', flags: 64 });
  }

  // Log to txt
  const log = `Warning #${data[target.id].length} | ${new Date().toISOString()} | Mod: ${interaction.user.tag} | User: ${target.tag} | Reason: ${reason}\n`;
  fs.appendFileSync(path.join(process.cwd(), 'warnings.txt'), log);

  // Try DM
  target.send(`You received a warning: **${reason}**\nTotal warnings: ${data[target.id].length}`).catch(() => {});

  let msg = `${target.tag} warned. Total: ${data[target.id].length}`;
  if (data[target.id].length >= MAX_WARNINGS) {
    msg += `\n⚠️ Reaching ${MAX_WARNINGS} warnings — consider further action.`;
  }

  return interaction.reply({ content: msg, flags: 64 });
}