// src/commands/economy/leaderboard.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../../models/User.js';
import Portfolio from '../../models/Portfolio.js';
import Stock from '../../models/Stock.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Top 10 richest users in the server');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const users = await User.find({}).sort({ balance: -1 });

    if (users.length === 0) {
      return interaction.editReply({ content: 'No users have NEXI Coins yet.' });
    }

    // Calculate net worth for each user (balance + portfolio value)
    const usersWithNetWorth = await Promise.all(
      users.map(async (user) => {
        // Get portfolio
        const portfolio = await Portfolio.findOne({ userId: user.userId });
        let portfolioValue = 0;

        // Calculate total portfolio value
        if (portfolio && portfolio.stocks && portfolio.stocks.length > 0) {
          for (const holding of portfolio.stocks) {
            const stock = await Stock.findOne({ ticker: holding.ticker });
            if (stock) {
              portfolioValue += stock.price * holding.quantity;
            }
          }
        }

        const netWorth = user.balance + portfolioValue;
        return { user, portfolioValue, netWorth };
      })
    );

    // Sort by net worth
    usersWithNetWorth.sort((a, b) => b.netWorth - a.netWorth);

    // Take top 10
    const top10 = usersWithNetWorth.slice(0, 10);

    const embeds = [];

    for (let i = 0; i < top10.length; i++) {
      const { user, portfolioValue, netWorth } = top10[i];
      
      // Fetch Discord user for profile picture
      let discordUser;
      try {
        discordUser = await interaction.client.users.fetch(user.userId);
      } catch (err) {
        console.error(`Could not fetch user ${user.userId}`);
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`#${i + 1} • ${user.username}`)
        .setThumbnail(discordUser?.displayAvatarURL({ size: 256 }) || null)
        .addFields(
          { name: 'Balance', value: `${user.balance.toLocaleString()} NEXI`, inline: true },
          { name: 'Portfolio', value: `${portfolioValue.toLocaleString()} NEXI`, inline: true },
          { name: 'Net Worth', value: `${netWorth.toLocaleString()} NEXI`, inline: true }
        );

      if (discordUser) {
        embed.setFooter({ text: `ID: ${discordUser.tag}` });
      }

      embeds.push(embed);
    }

    // Send all embeds
    await interaction.editReply({ embeds: embeds });
  } catch (err) {
    console.error('Leaderboard error:', err);
    await interaction.editReply({ content: 'Failed to fetch leaderboard.', flags: 64 });
  }
}