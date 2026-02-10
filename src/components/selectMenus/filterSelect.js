// src/components/selectMenus/filterSelect.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

export const customId = 'listener_filter_select_'; // prefix

export async function execute(interaction, client) {
  const eventName = interaction.customId.slice(customId.length).trim();
  const selectedValue = interaction.values[0];

  if (!eventName || !selectedValue) {
    return interaction.update({
      content: 'Invalid selection or missing event.',
      components: [],
      embeds: [],
    }).catch(() => {});
  }

  // Load existing config
  const listenersFile = path.join(process.cwd(), 'listeners.json');
  let listeners = {};

  if (fs.existsSync(listenersFile)) {
    try {
      listeners = JSON.parse(fs.readFileSync(listenersFile, 'utf-8'));
    } catch {}
  }

  // Update filters
  if (!listeners[eventName]) {
    return interaction.update({ content: 'Listener not found.', components: [], embeds: [] });
  }

  if (!listeners[eventName].filters) {
    listeners[eventName].filters = {};
  }

  // Simple example: store selected filter type (expand this later)
  listeners[eventName].filters[selectedValue] = {
    type: selectedValue,
    addedAt: new Date().toISOString(),
    // Add more details (e.g. user ID, text pattern) via modal next
  };

  try {
    fs.writeFileSync(listenersFile, JSON.stringify(listeners, null, 2));
  } catch (err) {
    console.error('Failed to save filter:', err);
    return interaction.update({ content: 'Failed to save filter.', components: [], embeds: [] });
  }

  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle(`Filter Added • ${eventName}`)
    .setDescription(`Added **${selectedValue}** filter type.\n\nYou can add more or configure details.`);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`listener_proceed_${selectedValue}_${eventName}`)
      .setLabel('Add Details')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`listener_cancel_${eventName}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    embeds: [embed],
    components: [row],
  }).catch(console.error);
}