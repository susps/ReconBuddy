// src/events/guildMemberRemove.js
import { Events } from 'discord.js';
import { onMemberLeave } from '../services/inviteTracker.js';

export const name = Events.GuildMemberRemove;
export async function execute(member) {
  await onMemberLeave(member);
}