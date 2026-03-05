// src/commands/economy/stock.js
import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { 
  getStock, 
  buyStock, 
  sellStock, 
  getPortfolio, 
  getMarket,
  getRemainingSharesForTicker,
  generateChart
} from '../../services/stockMarket.js';
import { getUser } from '../../services/economy.js';

export const data = new SlashCommandBuilder()
  .setName('stock')
  .setDescription('Stock market commands')
  
  // Market overview
  .addSubcommand(sub =>
    sub.setName('market').setDescription('View all available stocks and prices')
  )
  
  // Your portfolio
  .addSubcommand(sub =>
    sub
      .setName('portfolio')
      .setDescription('View stock holdings and profit/loss')
      .addUserOption(opt => opt.setName('user').setDescription('User to view (leave blank for yourself)').setRequired(false))
  )
  
  // Buy shares
  .addSubcommand(sub =>
    sub
      .setName('buy')
      .setDescription('Buy shares of a stock')
      .addStringOption(opt => opt.setName('ticker').setDescription('Stock ticker (e.g. NEXI)').setRequired(true))
      .addIntegerOption(opt => opt.setName('quantity').setDescription('Number of shares').setMinValue(1).setRequired(true))
  )
  
  // Sell shares
  .addSubcommand(sub =>
    sub
      .setName('sell')
      .setDescription('Sell shares of a stock')
      .addStringOption(opt => opt.setName('ticker').setDescription('Stock ticker').setRequired(true))
      .addIntegerOption(opt => opt.setName('quantity').setDescription('Number of shares').setMinValue(1).setRequired(true))
  )
  
  // View detailed stock info
  .addSubcommand(sub =>
    sub
      .setName('view')
      .setDescription('View detailed info about a stock')
      .addStringOption(opt => opt.setName('ticker').setDescription('Stock ticker (e.g. NEXI)').setRequired(true))
  )
  
  // View price history (text list)
  .addSubcommand(sub =>
    sub
      .setName('history')
      .setDescription('View recent price history for a stock')
      .addStringOption(opt => opt.setName('ticker').setDescription('Stock ticker (e.g. NEXI)').setRequired(true))
  )
  
  // View price chart (canvas image)
  .addSubcommand(sub =>
    sub
      .setName('chart')
      .setDescription('View a price chart for a stock (last 24 hours)')
      .addStringOption(opt => opt.setName('ticker').setDescription('Stock ticker (e.g. NEXI)').setRequired(true))
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  // make buy/sell responses private, others public by default
  const ephemeral = ['buy', 'sell'].includes(sub);
  await interaction.deferReply({ ephemeral });

  const ticker = interaction.options.getString('ticker')?.toUpperCase();

  // sanity check (shouldn't trigger because options are required on subcommands)
  if ((sub === 'buy' || sub === 'sell' || sub === 'view') && !ticker) {
    return interaction.editReply({ content: '❌ Ticker symbol is required.', ephemeral: true });
  }

  if (sub === 'market') {
    const stocks = await getMarket();

    if (stocks.length === 0) {
      return interaction.editReply({ content: 'No stocks available yet.' });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Stock Market Overview')
      .setDescription('Current prices and stats')
      .setTimestamp();

    for (const stock of stocks) {
      const change24h = stock.history.length > 1
        ? ((stock.price - stock.history[stock.history.length - 2].price) / stock.history[stock.history.length - 2].price * 100).toFixed(2)
        : 0;

      const remaining = await getRemainingSharesForTicker(stock.ticker);

      embed.addFields({
        name: `${stock.ticker} - ${stock.name}`,
        value: `Price: **$${stock.price.toLocaleString()}**\n24h Change: ${change24h > 0 ? '+' : ''}${change24h}%\nVolatility: ${(stock.volatility * 100).toFixed(1)}%\nRemaining: **${remaining.toLocaleString()} / 5,000,000** shares`,
        inline: true,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'portfolio') {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const portfolio = await getPortfolio(targetUser.id);

    if (portfolio.length === 0) {
      const isOwn = targetUser.id === interaction.user.id;
      return interaction.editReply({ content: isOwn ? 'You have no stocks yet. Use /stock buy to start.' : `${targetUser.tag} has no stocks.` });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`${targetUser.tag}'s Portfolio`)
      .setDescription('Current holdings')
      .setTimestamp();

    let totalValue = 0;
    let totalCost = 0;

    for (const holding of portfolio) {
      const stock = await getStock(holding.ticker);
      if (!stock) continue;

      const currentValue = stock.price * holding.quantity;
      const buyValue = holding.buyPrice * holding.quantity;
      const profitLoss = currentValue - buyValue;
      const plText = profitLoss >= 0 ? `+$${profitLoss.toLocaleString()}` : `-$${Math.abs(profitLoss).toLocaleString()}`;

      totalValue += currentValue;
      totalCost += buyValue;

      embed.addFields({
        name: `${holding.ticker} - ${holding.quantity} shares`,
        value: `Buy Price: $${holding.buyPrice.toLocaleString()}\nCurrent Value: $${currentValue.toLocaleString()}\nP/L: **${plText}**`,
        inline: false,
      });
    }

    const netPL = totalValue - totalCost;
    const netPLText = netPL >= 0 ? `+$${netPL.toLocaleString()}` : `-$${Math.abs(netPL).toLocaleString()}`;

    embed.addFields({
      name: 'Portfolio Summary',
      value: `Total Value: **$${totalValue.toLocaleString()}**\nTotal Cost: $${totalCost.toLocaleString()}\nNet P/L: **${netPLText}**`,
      inline: false,
    });

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'buy') {
    const quantity = interaction.options.getInteger('quantity', true);

    const stock = await getStock(ticker);
    if (!stock) return interaction.editReply({ content: 'Stock not found. Use /stock market to see available stocks.' });

    const cost = stock.price * quantity;

    const user = await getUser(interaction.user.id, interaction.user.username);
    if (user.balance < cost) {
      return interaction.editReply({ content: `Not enough coins. You have $${user.balance.toLocaleString()}, need $${cost.toLocaleString()}.`, flags: 64 });
    }

    const { cost: paidCost, newBalance } = await buyStock(interaction.user.id, interaction.user.username, ticker, quantity);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Stock Purchase Successful')
      .setDescription(`You bought **${quantity}** shares of **${ticker}** (${stock.name}) at $${stock.price.toLocaleString()} each.`)
      .addFields(
        { name: 'Total Cost', value: `$${paidCost.toLocaleString()}`, inline: true },
        { name: 'New Balance', value: `$${newBalance.toLocaleString()}`, inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'sell') {
    const quantity = interaction.options.getInteger('quantity', true);

    const stock = await getStock(ticker);
    if (!stock) return interaction.editReply({ content: 'Stock not found.' });

    const { revenue, remaining } = await sellStock(interaction.user.id, ticker, quantity);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Stock Sale Successful')
      .setDescription(`You sold **${quantity}** shares of **${ticker}** (${stock.name}) at $${stock.price.toLocaleString()} each.`)
      .addFields(
        { name: 'Revenue', value: `$${revenue.toLocaleString()}`, inline: true },
        { name: 'Remaining Shares', value: remaining.toLocaleString(), inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'view') {
    const stock = await getStock(ticker);
    if (!stock) return interaction.editReply({ content: 'Stock not found. Use /stock market to see available stocks.' });

    const change24h = stock.history.length > 1
      ? ((stock.price - stock.history[stock.history.length - 2].price) / stock.history[stock.history.length - 2].price * 100).toFixed(2)
      : 0;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${stock.ticker} - ${stock.name}`)
      .setDescription(`Current Price: **$${stock.price.toLocaleString()}**`)
      .addFields(
        { name: '24h Change', value: `${change24h >= 0 ? '+' : ''}${change24h}%`, inline: true },
        { name: 'Volatility', value: `${(stock.volatility * 100).toFixed(1)}%`, inline: true },
        { name: 'Last Updated', value: stock.lastUpdated.toLocaleString(), inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'chart') {
    try {
      const chartBuffer = await generateChart(ticker);
      
      const attachment = new AttachmentBuilder(chartBuffer, { name: `${ticker}_chart.png` });
      
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${ticker} Price Chart (24h)`)
        .setDescription('Price movement over the last 24 hours')
        .setImage(`attachment://${ticker}_chart.png`)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (error) {
      return interaction.editReply({ content: `Error generating chart: ${error.message}`, flags: 64 });
    }
  }

  if (sub === 'history') {
    const stock = await getStock(ticker);
    if (!stock) {
      return interaction.editReply({ content: 'Stock not found. Use /stock market to see available stocks.' });
    }

    if (!stock.history || stock.history.length === 0) {
      return interaction.editReply({ content: 'No price history available for this stock yet.' });
    }

    const history = stock.history.slice(-20); // last 20 entries

    let historyText = '';
    history.reverse().forEach((entry, index) => {
      const time = entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const price = entry.price;
      historyText += `${index + 1}. ${time} - $${price.toLocaleString()}\n`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${ticker} - ${stock.name} Price History`)
      .setDescription('Last 20 price updates')
      .addFields({
        name: 'History',
        value: historyText || 'No history available',
      })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
}