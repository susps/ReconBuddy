const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the Magic 8-Ball a question.')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('The question you want to ask the Magic 8-Ball')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Predefined list of 8-ball responses
        const responses = [
            "It is certain.",
            "Without a doubt.",
            "You may rely on it.",
            "Yes, definitely.",
            "It is decidedly so.",
            "As I see it, yes.",
            "Most likely.",
            "Outlook good.",
            "Yes.",
            "Signs point to yes.",
            "Reply hazy, try again.",
            "Ask again later.",
            "Better not tell you now.",
            "Cannot predict now.",
            "Concentrate and ask again.",
            "Don't count on it.",
            "My reply is no.",
            "My sources say no.",
            "Outlook not so good.",
            "Very doubtful."
        ];

        // Get the user's question
        const question = interaction.options.getString('question');

        // Select a random response
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];

        // Create the embed message
        const embed = new EmbedBuilder()
            .setColor('#1E90FF')
            .setTitle('🎱 The Magic 8-Ball')
            .setDescription(`**Question:** ${question}\n**Answer:** ${randomResponse}`)
            .setTimestamp();

        // Send the response as an embed
        await interaction.reply({ embeds: [embed] });
    },
};
