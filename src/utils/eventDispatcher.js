// src/utils/eventDispatcher.js
import { Events } from 'discord.js';

const logChannelCache = new Map();

export async function dispatchEvent(eventName, payload, client) {
  // Basic logging for supported events
  const loggableEvents = [
    Events.MessageCreate,
    Events.MessageReactionAdd,
    Events.GuildMemberAdd,
    Events.GuildMemberRemove,
    Events.InviteCreate,
    Events.InviteDelete,
  ];
  if (!loggableEvents.includes(eventName)) return;

  // Find log channel (could be from config or listeners.json)
  let logChannelId = null;
  // Try listeners.json first
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const listenersFile = path.join(process.cwd(), 'listeners.json');
    if (fs.existsSync(listenersFile)) {
      const listeners = JSON.parse(fs.readFileSync(listenersFile, 'utf-8'));
      if (listeners[eventName] && listeners[eventName].channelId) {
        logChannelId = listeners[eventName].channelId;
      }
    }
  } catch {}
  // Only log if listeners.json has a valid entry
  if (!logChannelId) return;

  // Cache channel fetch
  let channel = logChannelCache.get(logChannelId);
  if (!channel) {
    channel = await client.channels.fetch(logChannelId).catch(() => null);
    if (channel) logChannelCache.set(logChannelId, channel);
  }
  if (!channel) return;

  // Compose log message
  let logMsg = `[${eventName}]`;
  if (payload.user) logMsg += ` User: ${payload.user.tag}`;
  if (payload.member) logMsg += ` Member: ${payload.member.user.tag}`;
  if (payload.message) logMsg += ` Message: ${payload.message.content}`;
  if (payload.emoji) logMsg += ` Emoji: ${payload.emoji.name}`;
  if (payload.invite) logMsg += ` Invite: ${payload.invite.code}`;

  await channel.send({ content: logMsg }).catch(() => {});
}
