// src/commands/fun/coinflip.js
import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ComponentType 
} from 'discord.js';
import { getUser, removeCoins, addCoins } from '../../services/economy.js';

export const data = new SlashCommandBuilder()
  .setName('coinflip')
  .setDescription('Flip a coin – optionally bet NEXI Coins against another user')
  .addUserOption(option =>
    option
      .setName('opponent')
      .setDescription('User to coinflip against (optional – for bets)')
      .setRequired(false)
  )
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('Amount of NEXI Coins to bet (optional – requires opponent)')
      .setRequired(false)
      .setMinValue(1)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const opponent = interaction.options.getUser('opponent');
  const amount = interaction.options.getInteger('amount') || 0;

  // ─── Simple flip (no bet) ───────────────────────────────────────────────
  if (!opponent || amount <= 0) {
    const result = Math.floor(Math.random() * 2) === 0 ? 'Heads' : 'Tails';

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🪙 Coin Flip Result')
      .setDescription(`The coin landed on **${result}**!`)
      .setTimestamp()
      .setFooter({ text: `Flipped by ${interaction.user.tag}` });

    return interaction.editReply({ embeds: [embed] });
  }

  // ─── Bet flip ───────────────────────────────────────────────────────────
  if (opponent.bot) {
    return interaction.editReply({ content: 'You cannot bet against bots.', ephemeral: true });
  }

  if (opponent.id === interaction.user.id) {
    return interaction.editReply({ content: 'You cannot bet against yourself.', ephemeral: true });
  }

  const challenger = interaction.user;
  const challengerUser = await getUser(challenger.id, challenger.username);
  const opponentUser = await getUser(opponent.id, opponent.username);

  if (challengerUser.balance < amount) {
    return interaction.editReply({ content: 'You do not have enough NEXI Coins for this bet.', ephemeral: true });
  }

  if (opponentUser.balance < amount) {
    return interaction.editReply({ content: `${opponent.tag} does not have enough NEXI Coins for this bet.`, ephemeral: true });
  }

  // Generate unique bet ID for button customIds
  const betId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  // Send challenge embed with Accept/Decline buttons
  const challengeEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🪙 Coin Flip Bet Challenge')
    .setDescription(`${challenger.tag} has challenged ${opponent.tag} to a coin flip bet for **${amount} NEXI Coins**!\n\n${opponent.tag}, accept?`)
    .addFields(
      { name: 'Challenger Balance', value: `${challengerUser.balance}`, inline: true },
      { name: 'Opponent Balance', value: `${opponentUser.balance}`, inline: true },
      { name: 'Bet Amount', value: `${amount}`, inline: true }
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bet_accept_${betId}`)
      .setLabel('Accept Bet')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`bet_decline_${betId}`)
      .setLabel('Decline Bet')
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ embeds: [challengeEmbed], components: [row] });

  // Create collector for Accept/Decline buttons (5 min timeout)
  const filter = i => i.user.id === opponent.id && [`bet_accept_${betId}`, `bet_decline_${betId}`].includes(i.customId);
  const collector = interaction.channel.createMessageComponentCollector({ 
    filter, 
    time: 5 * 60 * 1000, 
    componentType: ComponentType.Button 
  });

  collector.on('collect', async i => {
    await i.deferUpdate().catch(() => {});

    if (i.customId === `bet_decline_${betId}`) {
      return i.editReply({
        content: `${opponent.tag} declined the bet.`,
        embeds: [],
        components: [],
      });
    }

    // Accepted – flip the coin
    const result = Math.floor(Math.random() * 2) === 0 ? 'Heads' : 'Tails';

    const resultEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🪙 Coin Flip Bet Result')
      .setDescription(`The coin landed on **${result}**!`)
      .addFields(
        { name: 'Bet Amount', value: `${amount} NEXI Coins`, inline: true },
        { name: 'Challenger', value: challenger.toString(), inline: true },
        { name: 'Opponent', value: opponent.toString(), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Flipped by ${challenger.tag}` });

    let winner;
    if (result === 'Heads') {
      // Challenger wins
      winner = challenger;
      await addCoins(challenger.id, amount, challenger.username);
      await removeCoins(opponent.id, amount, opponent.username);
    } else {
      // Opponent wins
      winner = opponent;
      await addCoins(opponent.id, amount, opponent.username);
      await removeCoins(challenger.id, amount, challenger.username);
    }

    resultEmbed.addFields({ name: 'Winner', value: winner.toString(), inline: false });

    await i.editReply({ embeds: [resultEmbed], components: [] });
    collector.stop();
  });

  collector.on('end', (collected) => {
    if (collected.size === 0) {
      interaction.editReply({
        content: 'Bet challenge timed out (5 minutes).',
        embeds: [],
        components: [],
      }).catch(() => {});
    }
  });
}