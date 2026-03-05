// src/commands/utility/listener.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

export const data = new SlashCommandBuilder()
  .setName('listener')
  .setDescription('Manage event listeners')
  .addSubcommand(sub =>
    sub.setName('list').setDescription('List all listeners')
  )
  .addSubcommand(sub =>
    sub.setName('view').setDescription('View details for an event')
      .addStringOption(opt => opt.setName('event').setDescription('Event name').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('delete').setDescription('Delete a listener for an event')
      .addStringOption(opt => opt.setName('event').setDescription('Event name').setRequired(true))
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const listenersFile = path.join(process.cwd(), 'listeners.json');
  let listeners = {};
  if (fs.existsSync(listenersFile)) {
    try {
      listeners = JSON.parse(fs.readFileSync(listenersFile, 'utf-8'));
    } catch {}
  }

  if (sub === 'list') {
    const events = Object.keys(listeners);
    if (events.length === 0) return interaction.reply({ content: 'No listeners found.', ephemeral: true });
    const embed = new EmbedBuilder()
      .setTitle('Registered Listeners')
      .setDescription(events.map(e => `• ${e}`).join('\n'));
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'view') {
    const event = interaction.options.getString('event');
    const listener = listeners[event];
    if (!listener) return interaction.reply({ content: `No listener found for event: ${event}`, ephemeral: true });
    const embed = new EmbedBuilder()
      .setTitle(`Listener: ${event}`)
      .setDescription('```json\n' + JSON.stringify(listener, null, 2) + '\n```');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'delete') {
    const event = interaction.options.getString('event');
    if (!listeners[event]) return interaction.reply({ content: `No listener found for event: ${event}`, ephemeral: true });
    delete listeners[event];
    fs.writeFileSync(listenersFile, JSON.stringify(listeners, null, 2));
    return interaction.reply({ content: `Listener for event **${event}** deleted.`, ephemeral: true });
  }
}
