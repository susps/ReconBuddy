import { SlashCommandBuilder } from 'discord.js';
import ms from 'ms';  // Ensure the 'ms' package is installed (npm install ms)

export const data = new SlashCommandBuilder()
    .setName('remindme')
    .setDescription('Sets a reminder for a specified duration.')
    .addStringOption(option =>
        option.setName('time')
            .setDescription('Time after which you want to be reminded (e.g., 10m, 1h, 2d).')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('reminder')
            .setDescription('What would you like to be reminded of?')
            .setRequired(true));

export async function execute(interaction) {
        const timeInput = interaction.options.getString('time');
        const reminder = interaction.options.getString('reminder');

        // Convert the provided time to milliseconds
        const timeMs = ms(timeInput);
        if (!timeMs || timeMs <= 0) {
            return interaction.reply({ content: `Invalid time format. Please provide a valid time (e.g., 10m, 1h, 2d).`, ephemeral: true });
        }

        // Confirm the reminder has been set
        await interaction.reply({ content: `I will remind you about: "${reminder}" in ${timeInput}.`, ephemeral: true });

    // Wait for the specified duration before reminding the user
    setTimeout(() => {
        interaction.user.send(`⏰ **Reminder**: ${reminder}`);
    }, timeMs);
}
