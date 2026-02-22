// src/commands/utility/roles.js
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { loadWelcomeConfig } from '../../services/welcome.js';

export const data = new SlashCommandBuilder()
  .setName('roles')
  .setDescription('Open the self-role selection menu')
  .setDMPermission(false);

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 }).catch(() => {});

  try {
    const config = await loadWelcomeConfig();

    if (!config.enabled || !config.selfRoles?.length) {
      return interaction.editReply({ content: 'Self-role selection is not configured yet.' });
    }

    const member = interaction.member;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Role Selection – ${interaction.guild.name}`)
      .setDescription(
        'Choose the roles that interest you!\n\n' +
        'Your selection will update immediately.'
      )
      .setThumbnail(interaction.guild.iconURL())
      .setFooter({ text: 'You can reopen this menu anytime with /roles' })
      .setTimestamp();

    const roleMenu = new StringSelectMenuBuilder()
      .setCustomId('self_role_select')
      .setPlaceholder('Select your roles...')
      .setMinValues(0)
      .setMaxValues(config.selfRoles.length)
      .addOptions(
        config.selfRoles.map(role => ({
          label: role.label,
          value: role.id,
          emoji: role.emoji || undefined,
          default: member.roles.cache.has(role.id), // pre-check current roles
        }))
      );

    const row = new ActionRowBuilder().addComponents(roleMenu);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

  } catch (err) {
    console.error('Error in /roles:', err);
    await interaction.editReply({
      content: 'Something went wrong while loading the role menu.',
    }).catch(() => {});
  }
}