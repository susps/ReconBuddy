// src/events/ready.js
export const name = 'clientReady';
export const once = true;

/**
 * @param {import('discord.js').Client} client
 */
export async function execute(client) {
  console.log(`[READY] Logged in as ${client.user.tag} (${client.user.id})`);
  console.log(`[READY] Serving ${client.guilds.cache.size} guilds • ${client.users.cache.size} users`);

  const { startStatusRotation } = await import('../utils/statusRotator.js');

  startStatusRotation(client);
}