// src/commands/support/ticket.js
import { SlashCommandBuilder } from 'discord.js';
import { createTicket } from '../../services/ticket.js';
import { getGuildConfig } from '../../services/ticket.js';

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Create a private support ticket')

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const config = getGuildConfig(interaction.guildId);

  if (!config.staffRoleId) {
    return interaction.editReply({ content: 'Ticket system is not configured yet.', ephemeral: true });
  }

  const ticketChannel = await createTicket(interaction);

  if (ticketChannel) {
    return interaction.editReply({ content: `Your ticket has been created: ${ticketChannel.toString()}.` });
  } else {
    return interaction.editReply({ content: 'Failed to create ticket. Check bot permissions.', ephemeral: true });
  }
}