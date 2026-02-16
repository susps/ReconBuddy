// src/events/inviteCreate.js
import { Events } from 'discord.js';
import { onInviteCreate } from '../services/inviteTracker.js';

export const name = Events.InviteCreate;
export async function execute(invite) {
  await onInviteCreate(invite);
}