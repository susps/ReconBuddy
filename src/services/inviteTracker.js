// src/services/inviteTracker.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { EmbedBuilder } from 'discord.js';

const INVITES_FILE = path.join(process.cwd(), 'data/invites.json');

let inviteCache = new Map(); // guildId → Map<inviteCode, { uses: number, inviterId: string }>
let inviteStats = {}; // guildId → Map<inviterId, { invites: number, leaves: number }>

// Load stats from file
async function loadStats() {
  try {
    const data = await fs.readFile(INVITES_FILE, 'utf-8');
    inviteStats = JSON.parse(data);
  } catch {
    inviteStats = {};
  }
}

// Save stats to file
async function saveStats() {
  await fs.mkdir(path.dirname(INVITES_FILE), { recursive: true });
  await fs.writeFile(INVITES_FILE, JSON.stringify(inviteStats, null, 2));
}

// Cache invites for a guild
export async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const map = new Map();
    invites.forEach(inv => {
      map.set(inv.code, { uses: inv.uses, inviterId: inv.inviterId });
    });
    inviteCache.set(guild.id, map);
  } catch (err) {
    if (err.code === 50013) {
      console.warn(`Skipping invite cache for guild ${guild.name} (${guild.id}) - missing permissions`);
    } else {
      console.error('Failed to cache invites for guild:', guild.name, err);
    }
  }
}

// Handle new invite creation
export async function onInviteCreate(invite) {
  const cached = inviteCache.get(invite.guild.id) || new Map();
  cached.set(invite.code, { uses: 0, inviterId: invite.inviterId });
  inviteCache.set(invite.guild.id, cached);
}

// Handle invite deletion
export async function onInviteDelete(invite) {
  const cached = inviteCache.get(invite.guild.id);
  if (cached) {
    cached.delete(invite.code);
  }
}

// Handle member join – attribute invite
export async function onMemberJoin(member) {
  const guild = member.guild;

  const oldInvites = inviteCache.get(guild.id) || new Map();
  const newInvites = await guild.invites.fetch();

  let usedInvite = null;
  let inviterId = null;

  newInvites.forEach(inv => {
    const oldUses = oldInvites.get(inv.code)?.uses || 0;
    if (inv.uses > oldUses) {
      usedInvite = inv.code;
      inviterId = inv.inviterId;
    }
  });

  if (inviterId) {
    const guildStats = inviteStats[guild.id] || new Map();
    const userStats = guildStats.get(inviterId) || { invites: 0, leaves: 0 };
    userStats.invites += 1;
    guildStats.set(inviterId, userStats);
    inviteStats[guild.id] = guildStats;

    await saveStats();

    console.log(`${member.user.tag} joined via invite ${usedInvite} from ${inviterId}`);
  } else {
    console.log(`${member.user.tag} joined – invite not tracked (possibly vanity or widget)`);
  }

  // Re-cache invites
  await cacheInvites(guild);
}

// Handle member leave – decrement stats (optional)
export async function onMemberLeave(member) {
  const guild = member.guild;
  const guildStats = inviteStats[guild.id] || new Map();
  const inviterId = member.invitedById; // if you track this per member (add later)

  if (inviterId) {
    const userStats = guildStats.get(inviterId) || { invites: 0, leaves: 0 };
    userStats.leaves += 1;
    guildStats.set(inviterId, userStats);
    inviteStats[guild.id] = guildStats;

    await saveStats();
  }
}

// Get stats embed for /invitestats
export function getInviteStatsEmbed(guildId) {
  const guildStats = inviteStats[guildId] || new Map();

  if (guildStats.size === 0) {
    return new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Invite Stats')
      .setDescription('No invites tracked yet.');
  }

  const sorted = [...guildStats.entries()].sort((a, b) => b[1].invites - a[1].invites).slice(0, 10);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Invite Leaderboard')
    .setTimestamp();

  sorted.forEach(([inviterId, stats], index) => {
    embed.addFields({
      name: `#${index + 1} <@${inviterId}>`,
      value: `Invites: ${stats.invites}\nLeaves: ${stats.leaves}\nNet: ${stats.invites - stats.leaves}`,
      inline: false,
    });
  });

  return embed;
}

// Load on bot start
loadStats().catch(err => console.error('Failed to load invite stats:', err));