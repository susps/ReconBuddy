// src/commands/fun/slots.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser, removeCoins, addCoins, addToHouse } from '../../services/economy.js';

// Slot symbols and their payout multipliers (relative to bet)
const SYMBOLS = [
  { emoji: '🍒', name: 'Cherry', payout: 2 },
  { emoji: '🍋', name: 'Lemon', payout: 3 },
  { emoji: '🍊', name: 'Orange', payout: 4 },
  { emoji: '🍇', name: 'Grape', payout: 5 },
  { emoji: '🔔', name: 'Bell', payout: 10 },
  { emoji: '💎', name: 'Diamond', payout: 20 }, // jackpot
];

const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

export const data = new SlashCommandBuilder()
  .setName('slots')
  .setDescription('Play the slot machine - gamble NEXI Coins!')
  .addIntegerOption(option =>
    option
      .setName('bet')
      .setDescription('Amount to bet (1-500 NEXI Coins)')
      .setMinValue(1)
      .setMaxValue(500)
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const bet = interaction.options.getInteger('bet', true);

  if (bet < 1 || bet > 500) {
    return interaction.editReply({ content: 'Bet must be between 1 and 500 NEXI Coins.', flags: 64 });
  }

  const user = await getUser(interaction.user.id, interaction.user.username);

  if (user.balance < bet) {
    return interaction.editReply({
      content: `You only have **${user.balance.toLocaleString()}** NEXI Coins. You can't afford this bet.`,
      flags: 64,
    });
  }

  // Cooldown check (simple – stored in DB)
  const now = Date.now();
  if (user.lastSlots && now - user.lastSlots < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - user.lastSlots)) / 1000);
    return interaction.editReply({
      content: `Slow down! You can spin again in **${remaining} seconds**.`,
      flags: 64,
    });
  }

  // Deduct bet first and collect to house
  await removeCoins(interaction.user.id, bet);
  await addToHouse(bet);

  // Spin the reels!
  const reel1 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const reel2 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  const reel3 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

  const reels = [reel1, reel2, reel3];

  // Check win
  let payout = 0;
  let winType = 'loss';

  if (reel1 === reel2 && reel2 === reel3) {
    // Jackpot – all three same
    payout = bet * reel1.payout * 2; // bonus multiplier for triple match
    winType = 'jackpot';
  } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
    // Partial match (two same)
    payout = bet * reel1.payout;
    winType = 'partial';
  }

  // Update balance
  if (payout > 0) {
    await addCoins(interaction.user.id, payout);
  }

  // Update last spin time
  user.lastSlots = now;
  await user.save();

  // Refresh user for accurate balance display
  const updatedUser = await getUser(interaction.user.id, interaction.user.username);

  // Build result embed
  const embed = new EmbedBuilder()
    .setColor(payout > 0 ? 0x57f287 : 0xed4245)
    .setTitle(payout > 0 ? '🎰 JACKPOT!' : '🎰 Slot Machine')
    .setDescription(
      `**${reel1.emoji} | ${reel2.emoji} | ${reel3.emoji}**\n\n` +
      (payout > 0
        ? `You won **${payout.toLocaleString()}** NEXI Coins!`
        : 'Better luck next time...')
    )
    .addFields(
      { name: 'Bet', value: `${bet.toLocaleString()}`, inline: true },
      { name: 'Payout', value: payout > 0 ? `+${payout.toLocaleString()}` : '0', inline: true },
      { name: 'New Balance', value: updatedUser.balance.toLocaleString(), inline: true }
    )
    .setFooter({ text: `Spun by ${interaction.user.tag}` })
    .setTimestamp();

  if (winType === 'jackpot') {
    embed.setThumbnail('../../assets/images/jackpot.gif'); // optional jackpot gif
  }

  await interaction.editReply({ embeds: [embed] });
}