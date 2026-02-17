const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin to get either Heads or Tails.'),

    async execute(interaction) {
        // Generate random result: 0 = Heads, 1 = Tails
        const result = Math.floor(Math.random() * 2) === 0 ? 'Heads' : 'Tails';

        // Create the embed message
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🪙 Coin Flip Result')
            .setDescription(`The coin landed on **${result}**!`)
            .setTimestamp();

        // Send the embed as the command response
        await interaction.reply({ embeds: [embed] });
    },
};
