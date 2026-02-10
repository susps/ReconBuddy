// src/components/buttons/listenerConfigure.js
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';

export const customId = 'listener_configure_'; // prefix for dynamic eventName

/**
 * Handles "Configure" button clicks
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {import('discord.js').Client} client
 */
export async function execute(interaction, client) {
  // Extract eventName from the remaining part of customId
  const eventName = interaction.customId.slice(customId.length).trim();

  if (!eventName) {
    return interaction.editReply({
      content: 'Missing event name in button configuration.',
      components: [],
    }).catch(() => {});
  }

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`Configure Filters • ${eventName}`)
    .setDescription('Pick a filter type to add / edit:')
    .setFooter({ text: 'Select an option below' });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`listener_filter_select_${eventName}`)
    .setPlaceholder('Select filter type...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('User ID')
        .setValue('user')
        .setEmoji('👤'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Contains text')
        .setValue('contains')
        .setEmoji('📝'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Reaction emoji')
        .setValue('emoji')
        .setEmoji('😄'),
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.editReply({
    embeds: [embed],
    components: [row],
  }).catch(console.error);
}