import fs from 'node:fs/promises';
import path from 'node:path';

const CONFIG_FILE = path.join(process.cwd(), 'data/antiraid.json');

const defaultConfig = {
  join: {
    enabled: false,
    maxJoins: 5,           // max joins allowed...
    timeWindow: 60 * 1000, // ...in this time window (ms)
    action: 'kick',        // 'kick', 'ban', 'timeout'
    timeoutDuration: 10 * 60 * 1000, // 10 min if timeout
  },
  message: {
    enabled: false,
    maxMessages: 8,        // max messages...
    timeWindow: 10 * 1000, // ...in this time window (ms)
    action: 'mute',        // 'mute', 'kick', 'ban'
    muteDuration: 5 * 60 * 1000, // 5 min mute
  },
};

let guildConfigs = {};

/**
 * Load config from disk
 */
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    guildConfigs = JSON.parse(data);
  } catch {
    guildConfigs = {};
  }
}

/**
 * Save config to disk
 */
async function saveConfig() {
  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(guildConfigs, null, 2));
}

/**
 * Get config for a guild (with defaults)
 * @param {string} guildId
 * @returns {object}
 */
export function getGuildConfig(guildId) {
  return guildConfigs[guildId] || { ...defaultConfig };
}

/**
 * Update config for a guild and save
 * @param {string} guildId
 * @param {object} newConfig
 */
export async function updateGuildConfig(guildId, newConfig) {
  guildConfigs[guildId] = { ...getGuildConfig(guildId), ...newConfig };
  await saveConfig();
}

// Load config on startup
loadConfig().catch(console.error);

// ─────────────────────────────────────────────────────────────────────────────
// Join rate limit (anti-raid)
// ─────────────────────────────────────────────────────────────────────────────

const joinTimestamps = new Map(); // guildId → [timestamp1, timestamp2, ...]

const raidModeActive = new Map(); // guildId → boolean

/**
 * Check if raid mode is active for a guild
 */
export function isRaidModeActive(guildId) {
  return raidModeActive.get(guildId) || false;
}

/**
 * Toggle raid mode for a guild
 * @param {string} guildId
 * @param {boolean} enabled
 */
export async function setRaidMode(guildId, enabled) {
  raidModeActive.set(guildId, enabled);

  // Optional: log to staff channel if configured
  const config = getGuildConfig(guildId);
  if (config.logChannelId) {
    const channel = await client.channels.fetch(config.logChannelId).catch(() => null);
    if (channel?.isTextBased()) {
      channel.send({
        embeds: [{
          color: enabled ? 0xff0000 : 0x57f287,
          title: enabled ? 'Raid Mode ENABLED' : 'Raid Mode DISABLED',
          description: `Raid protections are now **${enabled ? 'active' : 'inactive'}**.`,
          timestamp: new Date(),
        }],
      }).catch(() => {});
    }
  }
}

// When checking joins – apply stricter limits if raid mode is on
export function checkJoinRateLimit(guildId, member) {
  const config = getGuildConfig(guildId).join;
  if (!config.enabled) return false;

  // Stricter in raid mode
  const effectiveMax = isRaidModeActive(guildId) ? Math.max(2, config.maxJoins - 3) : config.maxJoins;
  const effectiveWindow = isRaidModeActive(guildId) ? Math.max(10000, config.timeWindow / 2) : config.timeWindow;

  const now = Date.now();
  const windowStart = now - effectiveWindow;

  let timestamps = joinTimestamps.get(guildId) || [];
  timestamps = timestamps.filter(ts => ts > windowStart);
  timestamps.push(now);

  joinTimestamps.set(guildId, timestamps);

  if (timestamps.length > effectiveMax) {
    let action = config.action;
    if (isRaidModeActive(guildId) && action === 'timeout') action = 'kick'; // escalate in raid mode

    if (action === 'kick') {
      member.kick(`Anti-raid protection (raid mode)`).catch(() => {});
    } else if (action === 'ban') {
      member.ban({ reason: 'Anti-raid protection (raid mode)' }).catch(() => {});
    } else if (action === 'timeout') {
      member.timeout(config.timeoutDuration, 'Anti-raid protection (raid mode)').catch(() => {});
    }

    return true;
  }

  return false;
}

// Message rate limit – stricter in raid mode
export function checkMessageRateLimit(message) {
  if (message.author.bot || !message.guild) return false;

  const config = getGuildConfig(message.guild.id).message;
  if (!config.enabled) return false;

  const key = `${message.author.id}:${message.guild.id}`;
  const now = Date.now();
  const windowStart = now - config.timeWindow;

  let timestamps = userMessageTimestamps.get(key) || [];
  timestamps = timestamps.filter(ts => ts > windowStart);
  timestamps.push(now);

  userMessageTimestamps.set(key, timestamps);

  // Stricter in raid mode
  const effectiveMax = isRaidModeActive(message.guild.id) ? Math.max(3, config.maxMessages - 3) : config.maxMessages;

  if (timestamps.length > effectiveMax) {
    let action = config.action;
    if (isRaidModeActive(message.guild.id) && action === 'mute') action = 'kick'; // escalate

    if (action === 'mute') {
      message.member.timeout(config.muteDuration, 'Anti-spam (raid mode)').catch(() => {});
    } else if (action === 'kick') {
      message.member.kick('Anti-spam (raid mode)').catch(() => {});
    } else if (action === 'ban') {
      message.member.ban({ reason: 'Anti-spam (raid mode)' }).catch(() => {});
    }

    message.delete().catch(() => {});

    return true;
  }

  return false;
}