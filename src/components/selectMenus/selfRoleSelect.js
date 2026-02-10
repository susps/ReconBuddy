// src/components/selectMenus/selfRoleSelect.js
import { loadWelcomeConfig } from '../../services/welcome.js';

export const customId = 'self_role_select';

export async function execute(interaction) {
  await interaction.deferUpdate().catch(() => {});

  try {
    const config = await loadWelcomeConfig();

    if (!interaction.guild) {
      return interaction.editReply({
        content: 'Role selection must be done in the server.\nPlease use /roles in a server channel.',
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

    const selected = interaction.values || [];

    for (const role of config.selfRoles) {
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role.id).catch(() => {});
      }
    }

    if (selected.length > 0) {
      await member.roles.add(selected);
    }

    await interaction.editReply({
      content: selected.length
        ? `Roles updated! You now have ${selected.length} role(s).`
        : 'No roles selected — your self-roles have been cleared.',
      components: [],
    });

  } catch (err) {
    console.error('Self-role select error:', err);

    await interaction.editReply({
      content: 'Something went wrong while updating your roles.',
      components: [],
    }).catch(() => {});
  }
}