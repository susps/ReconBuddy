// src/commands/economy/stock.js
import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { 
  getStock, 
  buyStock, 
  sellStock, 
  getPortfolio, 
  getMarket,
  generateChart,
} from '../../services/stockMarket.js';
import { getUser } from '../../services/economy.js';

export const data = new SlashCommandBuilder()
  .setName('stock')
  .setDescription('Stock market commands')
  .addSubcommand(sub => sub.setName('market').setDescription('View all stocks'))
  .addSubcommand(sub => sub.setName('portfolio').setDescription('Your holdings'))
  .addSubcommand(sub =>
    sub
      .setName('buy')
      .setDescription('Buy shares')
      .addStringOption(opt => opt.setName('ticker').setDescription('Ticker (e.g. NEXI)').setRequired(true))
      .addIntegerOption(opt => opt.setName('quantity').setDescription('Shares').setMinValue(1).setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('sell')
      .setDescription('Sell shares')
      .addStringOption(opt => opt.setName('ticker').setDescription('Ticker').setRequired(true))
      .addIntegerOption(opt => opt.setName('quantity').setDescription('Shares').setMinValue(1).setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('view')
      .setDescription('View stock details')
      .addStringOption(opt => opt.setName('ticker').setDescription('Ticker').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('chart')
      .setDescription('View price history chart')
      .addStringOption(opt => opt.setName('ticker').setDescription('Ticker').setRequired(true))
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const sub = interaction.options.getSubcommand();
  const ticker = interaction.options.getString('ticker')?.toUpperCase();

  if (sub === 'market') {
    const stocks = await getMarket();
    if (stocks.length === 0) return interaction.editReply({ content: 'No stocks yet.' });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Stock Market')
      .setDescription('Current prices');

    stocks.forEach(s => {
      embed.addFields({
        name: `${s.ticker} – ${s.name}`,
        value: `$${s.price.toLocaleString()}\nVolatility: ${(s.volatility*100).toFixed(1)}%`,
        inline: true,
      });
    });

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'portfolio') {
    const portfolio = await getPortfolio(interaction.user.id);
    if (portfolio.length === 0) return interaction.editReply({ content: 'No holdings yet.' });

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Your Portfolio');

    for (const h of portfolio) {
      const stock = await getStock(h.ticker);
      if (!stock) continue;
      const value = stock.price * h.quantity;
      const cost = h.buyPrice * h.quantity;
      const pl = value - cost;
      embed.addFields({
        name: `${h.ticker} (${h.quantity} shares)`,
        value: `Value: $${value.toLocaleString()}\nP/L: ${pl > 0 ? '+' : ''}$${pl.toLocaleString()}`,
        inline: false,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'buy') {
    const quantity = interaction.options.getInteger('quantity', true);

    const stock = await getStock(ticker);
    if (!stock) return interaction.editReply({ content: 'Stock not found.' });

    const cost = stock.price * quantity;

    const user = await getUser(interaction.user.id, interaction.user.username);
    if (user.balance < cost) return interaction.editReply({ content: 'Not enough coins.' });

    const { cost: paid, newBalance } = await buyStock(interaction.user.id, interaction.user.username, ticker, quantity);

    return interaction.editReply({
      content: `Bought ${quantity} shares of ${ticker} for $${paid.toLocaleString()}. New balance: $${newBalance.toLocaleString()}`,
    });
  }

  if (sub === 'sell') {
    const quantity = interaction.options.getInteger('quantity', true);

    const stock = await getStock(ticker);
    if (!stock) return interaction.editReply({ content: 'Stock not found.' });

    const { revenue, remaining } = await sellStock(interaction.user.id, ticker, quantity);

    return interaction.editReply({
      content: `Sold ${quantity} shares of ${ticker} for $${revenue.toLocaleString()}. Remaining: ${remaining}.`,
    });
  }

  if (sub === 'view') {
    const stock = await getStock(ticker);
    if (!stock) return interaction.editReply({ content: 'Stock not found.' });

    const change24h = stock.history.length > 1
      ? ((stock.price - stock.history[stock.history.length - 2].price) / stock.history[stock.history.length - 2].price * 100).toFixed(2)
      : 0;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${stock.ticker} – ${stock.name}`)
      .setDescription(`Current Price: **$${stock.price.toLocaleString()}**`)
      .addFields(
        { name: '24h Change', value: `${change24h > 0 ? '+' : ''}${change24h}%`, inline: true },
        { name: 'Volatility', value: `${(stock.volatility * 100).toFixed(1)}%`, inline: true },
        { name: 'Last Updated', value: stock.lastUpdated.toLocaleString(), inline: true }
      );

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'chart') {
    const stock = await getStock(ticker);
    if (!stock || stock.history.length < 2) {
      return interaction.editReply({ content: 'Not enough price history.', ephemeral: true });
    }

    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2f3136';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const prices = stock.history.map(h => h.price);
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const range = max - min || 1;

    ctx.beginPath();
    ctx.strokeStyle = '#57f287';
    ctx.lineWidth = 3;

    prices.forEach((price, i) => {
      const x = (i / (prices.length - 1)) * (canvas.width - 40) + 20;
      const y = canvas.height - 40 - ((price - min) / range) * (canvas.height - 80);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.fillText(`${ticker} Price (24h)`, 20, 30);
    ctx.fillText(`$${min.toLocaleString()}`, 20, canvas.height - 10);
    ctx.fillText(`$${max.toLocaleString()}`, 20, 40);

    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'chart.png' });

    await interaction.editReply({ files: [attachment] });
  }
}