import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("template")
    .setDescription("A template command to copy for new commands");

export async function execute(interaction) {
    await interaction.reply({
        content: "This is a template command. Copy this file and edit it to create new commands.",
        flags: 64,
    }).catch(() => { });
}