// src/commands/utility/listenerTemplates.js
import { SlashCommandBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

const templates = [
  {
    name: 'Anti-Spam',
    event: 'messageCreate',
    config: {
      enabled: true,
      filters: { contains: { type: 'contains', detail: 'spam' } },
      channelId: '',
    },
  },
  {
    name: 'Word Filter',
    event: 'messageCreate',
    config: {
      enabled: true,
      filters: { contains: { type: 'contains', detail: 'badword' } },
      channelId: '',
    },
  },
  {
    name: 'Reaction Roles',
    event: 'messageReactionAdd',
    config: {
      enabled: true,
      filters: { emoji: { type: 'emoji', detail: '👍' } },
      channelId: '',
    },
  },
];

export const data = new SlashCommandBuilder()
  .setName('listener-templates')
  .setDescription('Add a pre-made listener template')
  .addStringOption(opt =>
    opt.setName('template')
      .setDescription('Template name')
      .setRequired(true)
      .addChoices(...templates.map(t => ({ name: t.name, value: t.name })))
  );

export async function execute(interaction) {
  const templateName = interaction.options.getString('template');
  const template = templates.find(t => t.name === templateName);
  if (!template) return interaction.reply({ content: 'Template not found.', ephemeral: true });

  const listenersFile = path.join(process.cwd(), 'listeners.json');
  let listeners = {};
  if (fs.existsSync(listenersFile)) {
    try {
      listeners = JSON.parse(fs.readFileSync(listenersFile, 'utf-8'));
    } catch {}
  }

  listeners[template.event] = template.config;
  fs.writeFileSync(listenersFile, JSON.stringify(listeners, null, 2));
  return interaction.reply({ content: `Template **${template.name}** added for event **${template.event}**.`, ephemeral: true });
}
