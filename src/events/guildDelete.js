// src/events/guildDelete.js
export const name = 'guildDelete';
export const once = false;

export async function execute(guild, client) {
  console.log(`[GUILD LEAVE] ${guild.name} (${guild.id})`);

  // Optional: clean up guild-specific data from database
}