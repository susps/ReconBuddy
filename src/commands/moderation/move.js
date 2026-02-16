import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("move")
    .setDescription("Moves a user to a different voice channel")
    .addUserOption(opt =>
        opt.setName("target")
            .setDescription("The user to move"))
    .addChannelOption(opt =>
        opt.setName("channel")
            .setDescription("The voice channel to move the user to")
            .addChannelTypes(2) // Only allow voice channels
            .setRequired(true))
    .setDefaultMemberPermissions(0); // Only allow users with admin permissions to use this command

export async function execute(interaction) {
    const targetUser = interaction.options.getUser("target") || interaction.user;
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const targetChannel = interaction.options.getChannel("channel");

    if (!targetMember) {
        return interaction.editReply({ content: "User not found in this server.", ephemeral: true });
    }
    if(!targetMember.voice?.channel) {
        return interaction.editReply({ content: "User is not in a voice channel.", ephemeral: true });
    }
    if (targetMember.voice.channel.id === targetChannel.id) {
        return interaction.editReply({ content: "User is already in that voice channel.", ephemeral: true });
    }
    try {
        await targetMember.voice.setChannel(targetChannel);
        return interaction.editReply({ content: `Moved ${targetUser.tag} to ${targetChannel.name}.`, ephemeral: true });
    } catch (error) {
        console.error("Error moving user:", error);
        return interaction.editReply({ content: "Failed to move the user. Do I have the necessary permissions?", ephemeral: true });
    }
}