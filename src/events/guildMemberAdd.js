import { Events } from 'discord.js';
import { generateWelcomeImage, sendWelcomeDM } from '../services/welcome.js';
import { loadWelcomeConfig } from '../services/welcome.js';
import { checkJoinRateLimit } from '../services/antiSpam.js';
import { onMemberJoin } from '../services/inviteTracker.js';

export const name = Events.GuildMemberAdd;
export const once = false;

export async function execute(member, client) {
  
  await onMemberJoin(member);

  const config = await loadWelcomeConfig();
  if (!config.enabled) return;
  if (!member.guild) return;

  const actionTaken = checkJoinRateLimit(member.guild.id, member);

  if (actionTaken) {
    console.log(`Anti-raid action taken on ${member.user.tag} in ${member.guild.name}`);
  }
  // Welcome image in channel
  if (config.channelId) {
    const channel = await client.channels.fetch(config.channelId).catch(() => null);
    if (channel?.isTextBased()) {
      const attachment = await generateWelcomeImage(member);
      if (attachment) {
        const msg = config.message
          .replace('{user}', member.toString())
          .replace('{server}', member.guild.name);

        await channel.send({ content: msg, files: [attachment] }).catch(console.error);
      }
    }
  }

  // Send DM with role selection + verify button
  await sendWelcomeDM(member);
}