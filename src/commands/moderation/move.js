import { SlashCommandBuilder, PermissionsBitField } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("move")
    .setDescription("Moves a user to a different voice channel")
    .addUserOption(opt =>
        opt.setName("target")
            .setDescription("The user to move")
            .setRequired(true))
    .addChannelOption(opt =>
        opt.setName("channel")
            .setDescription("The voice channel to move the user to")
            .addChannelTypes(2) // Only allow voice channels
            .setRequired(true));    

export async function execute(interaction) {
    const targetUser = interaction.options.getUser('target') || interaction.user;
    const targetMember = interaction.options.getMember('target') || interaction.member;
    const channel = interaction.options.getChannel('channel');

    if (!targetMember) {
        return interaction.reply({
            content: "Unable to find the target member.",
            flags: 64
        }).catch(console.error);
    }

    // Check bot permissions
    if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.MoveMembers)) {
        return interaction.reply({
            content: "I don't have permission to move members.",
            flags: 64
        }).catch(console.error);
    }

    // Check user permissions if moving someone else
    const isSelfMove = targetMember.id === interaction.member.id;
    if (!isSelfMove && !interaction.member.permissions.has(PermissionsBitField.Flags.MoveMembers)) {
        return interaction.reply({
            content: "You don't have permission to move other members.",
            flags: 64
        }).catch(console.error);
    }

    if (!targetMember.voice?.channel) {
        return interaction.reply({
            content: "The target user is not in a voice channel.",
            flags: 64
        }).catch(console.error);
    }

    if (targetMember.voice.channel.id === channel.id) {
        return interaction.reply({
            content: "The target user is already in that channel.",
            flags: 64
        }).catch(console.error);
    }

    try {
        await targetMember.voice.setChannel(channel);
        await interaction.reply({
            content: `Moved ${targetUser.tag} to ${channel.name}.`,
            flags: 64
        }).catch(console.error);
    } catch (error) {
        console.error("Failed to move user:", error);
        await interaction.reply({
            content: "Failed to move the user. Check bot permissions (e.g., MOVE_MEMBERS) or channel access.",
            flags: 64
        }).catch(console.error);
    }
}