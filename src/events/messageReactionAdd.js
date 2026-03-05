// src/events/messageReactionAdd.js
import { Events } from 'discord.js';
import { dispatchEvent } from '../utils/eventDispatcher.js';

export const name = Events.MessageReactionAdd;
export const once = false;

export async function execute(reaction, user, client) {
  // Basic logging
  await dispatchEvent('messageReactionAdd', { reaction, user }, client);
}
