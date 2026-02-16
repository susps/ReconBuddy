// src/events/guildCreate.js
export const name = 'guildCreate';
export const once = false;

export async function execute(guild, client) {
  console.log(`[GUILD JOIN] ${guild.name} (${guild.id}) • ${guild.memberCount} members`);
  await cacheInvites(guild);
}