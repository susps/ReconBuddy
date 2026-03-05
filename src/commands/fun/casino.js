// src/commands/fun/casino.js
import { SlashCommandBuilder } from 'discord.js';
import * as slots from './slots.js';
import * as roulette from './roulette.js';
import * as coinflip from './coinflip.js';
import * as jackpot from './jackpot.js';

export const data = new SlashCommandBuilder()
  .setName('casino')
  .setDescription('All casino and gambling games')
  .addSubcommand(sub =>
    sub.setName('slots')
      .setDescription('Play the slot machine - gamble NEXI Coins!')
      .addIntegerOption(option =>
        option.setName('bet').setDescription('Amount to bet (1-500 NEXI Coins)').setMinValue(1).setMaxValue(500).setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('roulette')
      .setDescription('Bet on roulette — higher risk, higher reward (up to 100,000)')
      .addIntegerOption(option =>
        option.setName('bet').setDescription('Amount to bet (1 - 100,000 NEXI Coins)').setMinValue(1).setMaxValue(100000).setRequired(true)
      )
      .addStringOption(option =>
        option.setName('choice').setDescription('What you are betting on').setRequired(true)
          .addChoices(
            { name: 'Red', value: 'red' },
            { name: 'Black', value: 'black' },
            { name: 'Number (0-36)', value: 'number' }
          )
      )
      .addIntegerOption(option =>
        option.setName('number').setDescription('Number to bet on (0-36) — required if choice is Number').setMinValue(0).setMaxValue(36).setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub.setName('coinflip')
      .setDescription('Flip a coin – optionally bet NEXI Coins against another user')
      .addUserOption(option =>
        option.setName('opponent').setDescription('User to coinflip against (optional – for bets)').setRequired(false)
      )
      .addIntegerOption(option =>
        option.setName('amount').setDescription('Amount of NEXI Coins to bet (optional – requires opponent)').setMinValue(1).setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub.setName('jackpot')
      .setDescription('Buy a jackpot ticket — very high variance payouts (up to 100,000 bet)')
      .addIntegerOption(option =>
        option.setName('bet').setDescription('Amount to bet (1 - 100,000 NEXI Coins)').setMinValue(1).setMaxValue(100000).setRequired(true)
      )
  );

export async function execute(interaction, client) {
  const sub = interaction.options.getSubcommand();
  // Check high-roller status
  const { getUser } = await import('../../services/economy.js');
  const user = await getUser(interaction.user.id, interaction.user.username);
  const isHighRoller = user.inventory && (
    Array.isArray(user.inventory)
      ? user.inventory.some(i => (typeof i === 'string' ? i === 'casino_membership' : i.key === 'casino_membership'))
      : false
  );

  // Set high-roller flag on interaction if applicable
  if (isHighRoller) {
    interaction.__highRoller = true;
  }

  if (sub === 'slots') return slots.execute(interaction, client);
  if (sub === 'roulette') return roulette.execute(interaction, client);
  if (sub === 'coinflip') return coinflip.execute(interaction, client);
  if (sub === 'jackpot') return jackpot.execute(interaction, client);
  return interaction.reply({ content: 'Unknown casino game.', ephemeral: true });
}
