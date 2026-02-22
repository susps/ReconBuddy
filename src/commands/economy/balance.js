// src/commands/economy/balance.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser } from '../../services/economy.js';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Check your or someone else\'s NEXI Coin balance')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to check (leave blank for yourself)')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 });

  try {
    const target = interaction.options.getUser('user') || interaction.user;
    const user = await getUser(target.id, target.username);  // ← pass username here!

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`${target.tag}'s Balance`)
      .setThumbnail(target.displayAvatarURL({ size: 512 }))
      .addFields({
        name: 'NEXI Coins',
        value: user.balance.toLocaleString(),
        inline: true,
      })
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Balance command error:', err);
    await interaction.editReply({ content: 'Failed to fetch balance.', flags: 64 });
  }
}