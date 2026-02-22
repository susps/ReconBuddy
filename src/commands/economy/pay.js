// src/commands/economy/pay.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { transferCoins } from '../../services/economy.js';

export const data = new SlashCommandBuilder()
  .setName('pay')
  .setDescription('Send NEXI Coins to another user')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to send coins to')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('Amount of NEXI Coins to send')
      .setMinValue(1)
      .setRequired(true)
  );

export async function execute(interaction) {
  // Defer to allow async work and use editReply safely
  await interaction.deferReply();

  const target = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);

  if (target.id === interaction.user.id) {
    return interaction.editReply({ content: 'You cannot pay yourself.' });
  }

  try {
    const { fromBalance, toBalance } = await transferCoins(
      interaction.user.id,
      target.id,
      amount,
      interaction.user.username,  // challenger username
      target.username             // target username
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Payment Successful')
      .setDescription(`You sent **${amount.toLocaleString()}** NEXI Coins to ${target.tag}`)
      .addFields(
        { name: 'Your new balance', value: fromBalance.toLocaleString(), inline: true },
        { name: `${target.tag}'s new balance`, value: toBalance.toLocaleString(), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Paid by ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({ content: err.message, flags: 64 });
  }
}