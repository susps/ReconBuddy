// src/handlers/componentHandler.js
/**
 * Central dispatcher for buttons, select menus, and modals.
 * Loads handlers from src/components/{buttons,selectMenus,modals}/
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Map of customId prefix → handler module
 * @type {Map<string, { execute: Function, customId?: string | RegExp }>}
 */
const componentHandlers = new Map();

/**
 * Load all component handlers once at startup
 * @param {import('discord.js').Client} client
 */
export async function loadComponents(client) {
  const categories = ['buttons', 'selectMenus', 'modals'];

  for (const category of categories) {
    const dir = path.join(__dirname, '..', 'components', category);

    try {
      const files = (await fs.readdir(dir)).filter(file =>
        file.endsWith('.js') || file.endsWith('.mjs')
      );

      for (const file of files) {
        const filePath = path.join(dir, file);
        const fileUrl = pathToFileURL(filePath).href;
        const handler = await import(fileUrl);

        if (!handler?.customId || typeof handler.execute !== 'function') {
          console.warn(`Invalid component handler: ${category}/${file}`);
          continue;
        }

        // Support string prefix or RegExp
        const key = typeof handler.customId === 'string'
          ? handler.customId
          : handler.customId.source; // for display

        componentHandlers.set(handler.customId, handler);
        console.log(`[COMPONENT] Loaded → ${category}/${file} (id: ${key})`);
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log(`components/${category}/ not found – skipping`);
      } else {
        console.error(`Failed to load components/${category}:`, err);
      }
    }
  }

  console.log(`[COMPONENT] Total handlers loaded: ${componentHandlers.size}`);
}

/**
 * Main handler called from interactionCreate
 * @param {import('discord.js').Interaction} interaction
 * @param {import('discord.js').Client} client
 */
export async function handleComponent(interaction, client) {
  if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return false;

  const customId = interaction.customId;
  let matchedHandler = null;

  // Find the longest prefix match (greedy matching)
  for (const [prefix, handler] of componentHandlers.entries()) {
    if (typeof prefix === 'string') {
      if (customId.startsWith(prefix)) {
        if (!matchedHandler || prefix.length > matchedHandler.prefix.length) {
          matchedHandler = { handler, prefix };
        }
      }
    } else if (prefix instanceof RegExp && prefix.test(customId)) {
      matchedHandler = { handler, prefix };
      break; // RegExp usually takes priority
    }
  }

  if (!matchedHandler) {
    console.log(`[COMPONENT] No handler for customId: ${customId}`);
    return false;
  }

  const { handler } = matchedHandler;

  try {
    // Defer if needed — prevents timeout for slow operations
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => {});
    }

    await handler.execute(interaction, client);
    return true; // handled
  } catch (error) {
    console.error(`[COMPONENT ERROR] ${customId}:`, error);

    const fallbackReply = {
      content: 'Something went wrong while processing this component.',
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(fallbackReply).catch(() => {});
    } else {
      await interaction.reply(fallbackReply).catch(() => {});
    }

    return true;
  }
}