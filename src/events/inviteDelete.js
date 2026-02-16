// src/events/inviteDelete.js
import { Events } from 'discord.js';
import { onInviteDelete } from '../services/inviteTracker.js';

export const name = Events.InviteDelete;
export async function execute(invite) {
  await onInviteDelete(invite);
}