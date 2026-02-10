// src/components/buttons/cancel.js
export const customId = 'listener_cancel_'; // prefix

export async function execute(interaction, client) {
  await interaction.update({
    content: 'Configuration cancelled.',
    embeds: [],
    components: [],
  }).catch(() => {});
}