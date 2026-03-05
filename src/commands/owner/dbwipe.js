// src/commands/owner/dbwipe.js
// Provides an owner-only slash command for destructive database wipes.
// Requires a 6-digit TOTP from Google Authenticator (or any compatible app).
// To generate a secret for your account, run:
//   node -e "console.log(require('speakeasy').generateSecret({length:20}).base32)"
// then set OWNER_2FA_SECRET in your environment to that value.
// Install dependencies: npm install speakeasy

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import speakeasy from 'speakeasy';
import { wipeStocks, wipePortfolios } from '../../services/stockMarket.js';
import UserModel from '../../models/User.js';

export const data = new SlashCommandBuilder()
  .setName('dbwipe')
  .setDescription('Owner-only tool for wiping database sections (requires 2FA)')
  // owner-only permission as additional guard; primary check still uses OWNER_IDS
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(opt =>
    opt
      .setName('target')
      .setDescription('What part of the database to wipe')
      .setRequired(true)
      .addChoices(
        { name: 'stocks', value: 'stocks' },
        { name: 'portfolios', value: 'portfolios' },
        { name: 'users', value: 'users' },
        { name: 'all', value: 'all' }
      )
  )
  .addStringOption(opt =>
    opt
      .setName('code')
      .setDescription('Google Authenticator 6-digit code (two-factor)')
      .setRequired(true)
  );

export async function execute(interaction) {
  // enforce owner IDs list
  const ownerIds = process.env.OWNER_IDS?.split(',')?.map(id => id.trim()) || [];
  if (!ownerIds.includes(interaction.user.id)) {
    return interaction.reply({ content: 'This command is restricted to bot owners only.', flags: 64 });
  }

  await interaction.deferReply({ ephemeral: true });

  const target = interaction.options.getString('target', true);
  const code = interaction.options.getString('code', true);

  const secret = process.env.OWNER_2FA_SECRET;
  if (!secret) {
    return interaction.editReply({ content: '2FA secret not configured on the bot. Check environment variables.' });
  }

  const valid = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: 1, // allow one step before/after
  });

  if (!valid) {
    return interaction.editReply({ content: '❌ Invalid two-factor authentication code.' });
  }

  try {
    switch (target) {
      case 'stocks':
        await wipeStocks();
        break;
      case 'portfolios':
        await wipePortfolios();
        break;
      case 'users':
        await UserModel.deleteMany({});
        break;
      case 'all':
        await wipeStocks();
        await wipePortfolios();
        await UserModel.deleteMany({});
        break;
      default:
        throw new Error('unknown target');
    }

    await interaction.editReply({ content: `✅ Successfully wiped **${target}** collection(s).` });
  } catch (err) {
    console.error('dbwipe error:', err);
    await interaction.editReply({ content: `❌ Failed to wipe database: ${err.message}` });
  }
}
