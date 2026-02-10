// src/components/buttons/verifyButton.js
import { loadWelcomeConfig } from '../../services/welcome.js';

export const customId = 'verify_button';

export async function execute(interaction) {
  await interaction.deferUpdate().catch(() => {});

  try {
    const config = await loadWelcomeConfig();

    if (!config.verifiedRoleId) {
      return interaction.editReply({
        content: 'Verification role is not configured yet.',
        components: [],
      });
    }

    if (!interaction.guild) {
      return interaction.editReply({
        content: 'Verification must be done in the server.\nGo to the server and click "Verify Me" again there.',
        components: [],
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

    if (!member) {
      return interaction.editReply({
        content: 'Could not find your member data in this server.',
        components: [],
      });
    }

    if (member.roles.cache.has(config.verifiedRoleId)) {
      return interaction.editReply({
        content: 'You are already verified!',
        components: [],
      });
    }

    await member.roles.add(config.verifiedRoleId);

    await interaction.editReply({
      content: 'You are now verified! Welcome to the server 🎉\nYou can use `/roles` to choose more roles anytime.',
      embeds: [],
      components: [],
    });

  } catch (err) {
    console.error('Verify button error:', err);

    await interaction.editReply({
      content: 'Something went wrong while verifying you.',
      components: [],
    }).catch(() => {});
  }
}