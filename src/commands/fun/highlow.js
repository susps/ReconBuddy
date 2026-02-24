// src/commands/fun/highlow.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser, removeCoins, addCoins, addToHouse } from '../../services/economy.js';

export const data = new SlashCommandBuilder()
  .setName('highlow')
  .setDescription('Guess whether a number (1-100) will be High or Low — 2x payout on win')
  .addIntegerOption(option =>
    option
      .setName('bet')
      .setDescription('Amount to bet (1 - 20,000 NEXI Coins)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(20000)
  )
  .addStringOption(option =>
    option
      .setName('choice')
      .setDescription('Pick High or Low')
      .setRequired(true)
      .addChoices(
        { name: 'Low (1-50)', value: 'low' },
        { name: 'High (51-100)', value: 'high' }
      )
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const bet = interaction.options.getInteger('bet', true);
  const choice = interaction.options.getString('choice', true);

  if (bet < 1 || bet > 20000) {
    return interaction.editReply({ content: 'Bet must be between 1 and 20,000 NEXI Coins.', flags: 64 });
  }

  const user = await getUser(interaction.user.id, interaction.user.username);

  if (user.balance < bet) {
    return interaction.editReply({ content: `You only have **${user.balance.toLocaleString()}** NEXI Coins. You can't afford this bet.`, flags: 64 });
  }

  await removeCoins(interaction.user.id, bet, interaction.user.username);
  await addToHouse(bet);

  const spin = Math.floor(Math.random() * 100) + 1; // 1 - 100
  const isLow = spin <= 50;
  const won = (isLow && choice === 'low') || (!isLow && choice === 'high');

  let payout = 0;
  if (won) {
    payout = bet * 2; // 2x payout
    await addCoins(interaction.user.id, payout, interaction.user.username);
  }

  const updatedUser = await getUser(interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(won ? 0x57f287 : 0xed4245)
    .setTitle(won ? '⬆️⬇️ High/Low — You Won!' : '⬆️⬇️ High/Low — You Lost')
    .setDescription(`The number was **${spin}** (${isLow ? 'Low' : 'High'})\n\n${won ? `You won **${payout.toLocaleString()}** NEXI Coins!` : 'Better luck next time.'}`)
    .addFields(
      { name: 'Bet', value: `${bet.toLocaleString()}`, inline: true },
      { name: 'Payout', value: payout > 0 ? `+${payout.toLocaleString()}` : '0', inline: true },
      { name: 'New Balance', value: `${updatedUser.balance.toLocaleString()}`, inline: true }
    )
    .setFooter({ text: `Played by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

export default { data, execute };
