// src/events/interactionCreate.js
import { Events } from 'discord.js';

// Import the component handler function
import { handleComponent } from '../handlers/componentHandler.js';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction, client) {
  // ─── Slash Commands ────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.warn(`No command handler for /${interaction.commandName}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Command not implemented yet.',
          flags: 64,
        }).catch(() => {});
      }
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(`Command error /${interaction.commandName}:`, error);

      const errorReply = {
        content: 'There was an error executing this command.',
        flags: 64,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorReply).catch(() => {});
      } else {
        await interaction.reply(errorReply).catch(() => {});
      }
    }

    return;
  }

  // ─── Autocomplete ──────────────────────────────────────────
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      try {
        await command.autocomplete(interaction, client);
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
    }
    return;
  }

  // ─── Buttons, Select Menus, Modals ─────────────────────────
  if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
    const handled = await handleComponent(interaction, client);  // ← now imported

    if (!handled) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: 'This component is not handled yet.',
          flags: 64,
        }).catch(() => {});
      }
    }
    return;
  }

  // Unknown interaction type
  console.log(`Unhandled interaction type: ${interaction.type}`);
}