// src/commands/utility/serverinfo.js
import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Shows detailed information about this server');

export async function execute(interaction) {
  await interaction.deferReply();

  const { guild } = interaction;

  // Fetch owner safely
  let ownerTag = 'Unknown';
  try {
    const owner = await guild.fetchOwner();
    ownerTag = owner.user.tag;
  } catch {}

  const created = `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`;

  // Member counts
  const totalMembers = guild.memberCount;
  const bots = guild.members.cache.filter(m => m.user.bot).size;
  const humans = totalMembers - bots;

  // Channels
  const channels = guild.channels.cache;
  const text = channels.filter(c => [ChannelType.GuildText, ChannelType.GuildNews].includes(c.type)).size;
  const voice = channels.filter(c => [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type)).size;
  const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;

  // Roles & boosts
  const roles = guild.roles.cache.size - 1; // exclude @everyone
  const boostLevel = guild.premiumTier;
  const boostCount = guild.premiumSubscriptionCount || 0;

  // Verification level
  const verificationLevels = {
    0: 'None',
    1: 'Low',
    2: 'Medium',
    3: '(╯°□°）╯︵ ┻━┻ (High)',
    4: '┻━┻ ﾐヽ(ಠ益ಠ)ノ彡┻━┻ (Highest)',
  };
  const verification = verificationLevels[guild.verificationLevel];

  const embed = new EmbedBuilder()
    .setColor(guild.members.me.displayHexColor || 0x5865f2)
    .setTitle(`${guild.name} Server Information`)
    .setThumbnail(guild.iconURL({ size: 1024 }) || null)
    .setImage(guild.bannerURL({ size: 1024 }) || null)
    .setDescription(guild.description || 'No server description set.')
    .addFields(
      { name: '🆔 Server ID', value: guild.id, inline: true },
      { name: '👑 Owner', value: ownerTag, inline: true },
      { name: '📅 Created', value: created, inline: true },

      { name: '👥 Members', value: `${totalMembers.toLocaleString()}\n└ ${humans} humans • ${bots} bots`, inline: true },
      { name: '📚 Channels', value: `${text} text • ${voice} voice\n${categories} categories`, inline: true },
      { name: '🎭 Roles', value: roles.toString(), inline: true },

      { name: '🚀 Boost Status', value: `Level ${boostLevel}\n${boostCount} boosts`, inline: true },
      { name: '🔒 Verification', value: verification, inline: true },
      { name: '✨ Features', value: guild.features.join(', ') || 'None', inline: false }
    )
    .setFooter({ text: `Requested by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}