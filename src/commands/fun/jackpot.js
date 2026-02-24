// src/commands/fun/jackpot.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser, removeCoins, addCoins, addToHouse } from '../../services/economy.js';

export const data = new SlashCommandBuilder()
  .setName('jackpot')
  .setDescription('Buy a jackpot ticket — very high variance payouts (up to 100,000 bet)')
  .addIntegerOption(option =>
    option
      .setName('bet')
      .setDescription('Amount to bet (1 - 100,000 NEXI Coins)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100000)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const bet = interaction.options.getInteger('bet', true);

  if (bet < 1 || bet > 100000) {
    return interaction.editReply({ content: 'Bet must be between 1 and 100,000 NEXI Coins.', flags: 64 });
  }

  const user = await getUser(interaction.user.id, interaction.user.username);

  if (user.balance < bet) {
    return interaction.editReply({ content: `You only have **${user.balance.toLocaleString()}** NEXI Coins. You can't afford this bet.`, flags: 64 });
  }

  await removeCoins(interaction.user.id, bet, interaction.user.username);
  await addToHouse(bet);

  // Tiered random chances (1..10000)
  const roll = Math.floor(Math.random() * 10000) + 1;
  let payout = 0;
  let tierName = 'No Win';

  if (roll === 1) {
    // Mega jackpot — extremely rare
    payout = bet * 1000;
    tierName = 'Mega Jackpot';
  } else if (roll <= 10) {
    // Big jackpot
    payout = bet * 100;
    tierName = 'Big Jackpot';
  } else if (roll <= 110) {
    // Medium
    payout = bet * 10;
    tierName = 'Big Win';
  } else if (roll <= 1110) {
    // Small win
    payout = bet * 2;
    tierName = 'Small Win';
  }

  if (payout > 0) {
    await addCoins(interaction.user.id, payout, interaction.user.username);
  }

  const updatedUser = await getUser(interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(payout > 0 ? 0x57f287 : 0xed4245)
    .setTitle(payout > 0 ? `🎉 ${tierName}!` : '🎟️ Jackpot — No Win')
    .setDescription(
      `Roll: **${roll}**\n\n` +
      (payout > 0 ? `You won **${payout.toLocaleString()}** NEXI Coins (${tierName})!` : 'No luck this ticket.')
    )
    .addFields(
      { name: 'Bet', value: `${bet.toLocaleString()}`, inline: true },
      { name: 'Payout', value: payout > 0 ? `+${payout.toLocaleString()}` : '0', inline: true },
      { name: 'New Balance', value: `${updatedUser.balance.toLocaleString()}`, inline: true }
    )
    .setFooter({ text: `Ticket bought by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

export default { data, execute };
