// src/commands/utility/userinfo.js
import { SlashCommandBuilder, EmbedBuilder, userMention, time } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('Shows detailed information about a user')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to get info about (leave blank for yourself)')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 });

  const targetUser = interaction.options.getUser('user') || interaction.user;
  const member = interaction.guild?.members.cache.get(targetUser.id) || null;

  // Timestamps
  const created = time(Math.floor(targetUser.createdTimestamp / 1000), 'R');
  const joined = member ? time(Math.floor(member.joinedTimestamp / 1000), 'R') : 'Not in this server';

  // Roles (exclude @everyone)
  const roles = member?.roles.cache
    .filter(r => r.id !== interaction.guild?.id)
    .sort((a, b) => b.position - a.position)
    .map(r => r.toString())
    .join(', ') || 'None';

  // Badges / flags
  const badges = targetUser.flags.toArray().length > 0
    ? targetUser.flags.toArray().join(', ')
    : 'None';

  // Status & activity
  const status = member?.presence?.status || 'Offline';
  const activity = member?.presence?.activities[0]
    ? `${member.presence.activities[0].type}: ${member.presence.activities[0].name}`
    : 'None';

  // Banner (if Nitro user)
  const banner = targetUser.bannerURL({ size: 1024 }) || null;

  const embed = new EmbedBuilder()
    .setColor(member?.displayHexColor || targetUser.hexAccentColor || 0x5865f2)
    .setTitle(`${targetUser.tag} User Information`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 1024 }))
    .setImage(banner)
    .setDescription(userMention(targetUser.id))
    .addFields(
      { name: '🆔 User ID', value: targetUser.id, inline: true },
      { name: '📅 Account Created', value: created, inline: true },
      { name: '📅 Joined Server', value: joined, inline: true },

      { name: '🎭 Roles', value: roles || 'None', inline: false },
      { name: 'Status', value: status.charAt(0).toUpperCase() + status.slice(1), inline: true },
      { name: 'Activity', value: activity, inline: true },

      { name: '🏅 Badges', value: badges, inline: false }
    )
    .setFooter({ text: `Requested by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}