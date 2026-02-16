// src/components/buttons/createTicketButton.js
import { createTicket } from '../../services/ticket.js';
import { getGuildConfig } from '../../services/ticket.js';

export const customId = 'create_ticket_button';

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const config = getGuildConfig(interaction.guildId);

  const ticketChannel = await createTicket(interaction);

  if (ticketChannel) {
    await interaction.editReply({ content: `Ticket created: ${ticketChannel.toString()}` });
  } else {
    await interaction.editReply({ content: 'Failed to create ticket.' });
  }
}