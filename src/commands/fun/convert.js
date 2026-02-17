import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

const API_KEY = 'b9af52876943d395cec002e7'; // Insert your API key here
const BASE_URL = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/`;

export default {
    data: new SlashCommandBuilder()
        .setName('convert')
        .setDescription('Convert between currencies with live exchange rates.')
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('The amount of money to convert')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('from')
                .setDescription('Currency code to convert from (e.g., USD)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('to')
                .setDescription('Currency code to convert to (e.g., EUR)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const amount = interaction.options.getNumber('amount');
        const fromCurrency = interaction.options.getString('from').toUpperCase();
        const toCurrency = interaction.options.getString('to').toUpperCase();

        try {
            const response = await fetch(`${BASE_URL}${fromCurrency}`);
            const data = await response.json();

            if (!data.conversion_rates || !data.conversion_rates[toCurrency]) {
                return interaction.reply(`❌ Conversion failed. Make sure the currency codes are correct.`);
            }

            const rate = data.conversion_rates[toCurrency];
            const convertedAmount = (amount * rate).toFixed(2);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('💱 Currency Converter')
                .addFields(
                    { name: 'Amount', value: `${amount} ${fromCurrency}`, inline: true },
                    { name: 'Converted To', value: `${convertedAmount} ${toCurrency}`, inline: true },
                    { name: 'Exchange Rate', value: `1 ${fromCurrency} = ${rate} ${toCurrency}`, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.reply(`❌ An error occurred while fetching the exchange rate.`);
        }
    },
};
