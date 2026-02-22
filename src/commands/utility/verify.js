// src/commands/utility/verify.js
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadWelcomeConfig } from '../../services/welcome.js';

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Verify yourself to gain access to the rest of the server')
  .setDMPermission(false);

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 }).catch(() => {});

  try {
    const config = await loadWelcomeConfig();

    if (!config.enabled) {
      return interaction.editReply({ content: 'Verification is currently disabled.' });
    }

    if (!config.verifiedRoleId) {
      return interaction.editReply({ content: 'Verification role is not configured yet.' });
    }

    const member = interaction.member;

    // Already verified?
    if (member.roles.cache.has(config.verifiedRoleId)) {
      return interaction.editReply({ content: 'You are already verified!' });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`Verification – ${interaction.guild.name}`)
      .setDescription(
        'Click **Verify Me** below to gain full access to the server.\n\n' +
        'This is quick and secure.'
      )
      .setThumbnail(interaction.guild.iconURL({ size: 1024 }))
      .setFooter({ text: 'If you need roles, use /roles after verification' })
      .setTimestamp();

    const verifyBtn = new ButtonBuilder()
      .setCustomId('verify_button')
      .setLabel('Verify Me')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(verifyBtn);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

  } catch (err) {
    console.error('Error in /verify command:', err);
    await interaction.editReply({
      content: 'Something went wrong while preparing verification.',
    }).catch(() => {});
  }
}