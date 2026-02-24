// src/commands/fun/roulette.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser, removeCoins, addCoins, addToHouse } from '../../services/economy.js';

export const data = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('Bet on roulette — higher risk, higher reward (up to 100,000)')
  .addIntegerOption(option =>
    option
      .setName('bet')
      .setDescription('Amount to bet (1 - 100,000 NEXI Coins)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100000)
  )
  .addStringOption(option =>
    option
      .setName('choice')
      .setDescription('What you are betting on')
      .setRequired(true)
      .addChoices(
        { name: 'Red', value: 'red' },
        { name: 'Black', value: 'black' },
        { name: 'Number (0-36)', value: 'number' }
      )
  )
  .addIntegerOption(option =>
    option
      .setName('number')
      .setDescription('Number to bet on (0-36) — required if choice is Number')
      .setMinValue(0)
      .setMaxValue(36)
      .setRequired(false)
  );

function getColorForNumber(n) {
  if (n === 0) return 'green';
  // Simplified mapping: even -> black, odd -> red
  return (n % 2 === 0) ? 'black' : 'red';
}

export async function execute(interaction) {
  await interaction.deferReply();

  const bet = interaction.options.getInteger('bet', true);
  const choice = interaction.options.getString('choice', true);
  const numberChoice = interaction.options.getInteger('number');

  if (bet < 1 || bet > 100000) {
    return interaction.editReply({ content: 'Bet must be between 1 and 100,000 NEXI Coins.', flags: 64 });
  }

  const user = await getUser(interaction.user.id, interaction.user.username);

  if (user.balance < bet) {
    return interaction.editReply({ content: `You only have **${user.balance.toLocaleString()}** NEXI Coins. You can't afford this bet.`, flags: 64 });
  }

  // If user chose to bet on a number ensure they provided it
  if (choice === 'number' && (typeof numberChoice !== 'number')) {
    return interaction.editReply({ content: 'You must provide a `number` between 0 and 36 when betting on Number.', flags: 64 });
  }

  // Remove bet up-front and collect to house
  await removeCoins(interaction.user.id, bet, interaction.user.username);
  await addToHouse(bet);

  // Spin: 0-36
  const spin = Math.floor(Math.random() * 37);
  const spinColor = getColorForNumber(spin);

  let payout = 0;
  let won = false;
  let resultText = `${spin} (${spinColor.toUpperCase()})`;

  if (choice === 'number') {
    if (spin === numberChoice) {
      // Exact number hit — 35x payout (classic roulette style)
      payout = bet * 35;
      won = true;
    }
  } else {
    // color bet (red/black)
    if (spin !== 0 && spinColor === choice) {
      // Color win pays 2x (net +bet)
      payout = bet * 2;
      won = true;
    }
  }

  if (payout > 0) {
    await addCoins(interaction.user.id, payout, interaction.user.username);
  }

  // Refresh user object for accurate balance
  const updatedUser = await getUser(interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(won ? 0x57f287 : 0xed4245)
    .setTitle(won ? '🎲 Roulette — You Won!' : '🎲 Roulette — You Lost')
    .setDescription(`Spin result: **${resultText}**\n\n${won ? `You won **${payout.toLocaleString()}** NEXI Coins!` : 'No luck this spin.'}`)
    .addFields(
      { name: 'Bet', value: `${bet.toLocaleString()}`, inline: true },
      { name: 'Payout', value: payout > 0 ? `+${payout.toLocaleString()}` : '0', inline: true },
      { name: 'New Balance', value: `${updatedUser.balance.toLocaleString()}`, inline: true }
    )
    .setFooter({ text: `Spun by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

export default { data, execute };
