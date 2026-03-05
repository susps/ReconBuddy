// src/components/modals/filterDetailsModal.js
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export const customId = 'listener_filter_details_';

export function buildModal(selectedValue, eventName) {
  const modal = new ModalBuilder()
    .setCustomId(`${customId}${selectedValue}_${eventName}`)
    .setTitle('Add Filter Details');

  // Text input for filter details
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('filter_text')
        .setLabel('Filter Text/User ID/Emoji')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  return modal;
}

export async function execute(interaction, client) {
  const [selectedValue, eventName] = interaction.customId.slice(customId.length).split('_');
  const filterDetail = interaction.fields.getTextInputValue('filter_text');

  // Load and update listeners.json
  const fs = await import('node:fs');
  const path = await import('node:path');
  const listenersFile = path.join(process.cwd(), 'listeners.json');
  let listeners = {};
  if (fs.existsSync(listenersFile)) {
    try {
      listeners = JSON.parse(fs.readFileSync(listenersFile, 'utf-8'));
    } catch {}
  }
  if (!listeners[eventName] || !listeners[eventName].filters) {
    return interaction.reply({ content: 'Listener or filter not found.', ephemeral: true });
  }
  // Save details to the filter
  listeners[eventName].filters[selectedValue].detail = filterDetail;
  fs.writeFileSync(listenersFile, JSON.stringify(listeners, null, 2));

  await interaction.reply({ content: `Filter details saved: ${filterDetail}`, ephemeral: true });
}
