// src/components/buttons/closeTicket.js
import { getGuildConfig } from '../../services/ticket.js';
import { closeTicket } from '../../services/ticket.js';

export const customId = 'close_ticket';

export async function execute(interaction) {
  await interaction.deferUpdate().catch(() => {});

  const config = getGuildConfig(interaction.guildId);

  await closeTicket(interaction, config);
}