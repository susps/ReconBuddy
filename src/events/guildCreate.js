// src/events/guildCreate.js
export const name = 'guildCreate';
export const once = false;

export async function execute(guild, client) {
  console.log(`[GUILD JOIN] ${guild.name} (${guild.id}) • ${guild.memberCount} members`);

  // Optional: send welcome message to system channel
  // Optional: register guild-specific data in database
}