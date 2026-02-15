require('dotenv').config();

const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { getGuildSettings } = require('./store');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const SETTINGS_TTL_MS = Number(process.env.SETTINGS_CACHE_TTL_MS || 5000);

// key: guildId:userId -> [timestamps]
const switchLogs = new Map();
// key: guildId -> {value, expiresAt}
const settingsCache = new Map();
// key: guildId:userId -> nextAllowedActionAtMs
const actionCooldowns = new Map();

function getCachedGuildSettings(guildId) {
  const now = Date.now();
  const cached = settingsCache.get(guildId);
  if (cached && cached.expiresAt > now) return cached.value;

  const value = getGuildSettings(guildId);
  settingsCache.set(guildId, {
    value,
    expiresAt: now + SETTINGS_TTL_MS
  });
  return value;
}

function pushSwitch(guildId, userId, nowMs, windowMs) {
  const key = `${guildId}:${userId}`;
  const arr = switchLogs.get(key) || [];
  arr.push(nowMs);

  const cutoff = nowMs - windowMs;
  while (arr.length && arr[0] < cutoff) {
    arr.shift();
  }

  switchLogs.set(key, arr);
  return arr.length;
}

function inActionCooldown(guildId, userId, nowMs) {
  const key = `${guildId}:${userId}`;
  const nextAllowedAt = actionCooldowns.get(key) || 0;
  return nextAllowedAt > nowMs;
}

function setActionCooldown(guildId, userId, cooldownSeconds, nowMs) {
  const key = `${guildId}:${userId}`;
  actionCooldowns.set(key, nowMs + cooldownSeconds * 1000);
}

async function applyAction(member, settings) {
  if (settings.action === 'mute') {
    await member.voice.setMute(true, '10 秒內語音頻道切換超過上限');

    setTimeout(async () => {
      try {
        if (member.voice?.serverMute) {
          await member.voice.setMute(false, '自動解除禁言');
        }
      } catch (error) {
        console.error('Auto unmute failed:', error.message);
      }
    }, settings.muteDurationSeconds * 1000);
    return;
  }

  if (settings.action === 'kick') {
    if (member.kickable) {
      await member.kick('10 秒內語音頻道切換超過上限');
    }
    return;
  }

  if (settings.action === 'ban') {
    if (member.bannable) {
      await member.ban({ reason: '10 秒內語音頻道切換超過上限' });
    }
  }
}

function isUnverifiedMember(member, settings) {
  const byDiscordScreening = member.pending === true;
  const byRole = (settings.unverifiedRoleIds || []).some((roleId) => member.roles.cache.has(roleId));
  return byDiscordScreening || byRole;
}

setInterval(() => {
  const now = Date.now();

  for (const [key, times] of switchLogs.entries()) {
    if (times.length === 0 || now - times[times.length - 1] > 120000) {
      switchLogs.delete(key);
    }
  }

  for (const [key, nextAllowedAt] of actionCooldowns.entries()) {
    if (nextAllowedAt <= now) {
      actionCooldowns.delete(key);
    }
  }

  for (const [guildId, cache] of settingsCache.entries()) {
    if (cache.expiresAt <= now) {
      settingsCache.delete(guildId);
    }
  }
}, 30000);

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const guild = newState.guild;
    const member = newState.member;
    if (!guild || !member) return;

    const settings = getCachedGuildSettings(guild.id);
    if (!settings.enabled) return;
    if (settings.ignoreBots && member.user.bot) return;
    if (settings.whitelistRoleIds.some((roleId) => member.roles.cache.has(roleId))) return;
    if (settings.unverifiedOnly && !isUnverifiedMember(member, settings)) return;

    const oldChannel = oldState.channelId;
    const newChannel = newState.channelId;
    const isSwitch = oldChannel && newChannel && oldChannel !== newChannel;
    if (!isSwitch) return;

    const me = guild.members.me;
    if (!me) return;

    const perms = me.permissions;
    if (settings.action === 'mute' && !perms.has(PermissionsBitField.Flags.MuteMembers)) return;
    if (settings.action === 'kick' && !perms.has(PermissionsBitField.Flags.KickMembers)) return;
    if (settings.action === 'ban' && !perms.has(PermissionsBitField.Flags.BanMembers)) return;

    const nowMs = Date.now();
    const count = pushSwitch(guild.id, member.id, nowMs, settings.windowSeconds * 1000);

    if (count > settings.maxSwitches) {
      if (inActionCooldown(guild.id, member.id, nowMs)) {
        switchLogs.delete(`${guild.id}:${member.id}`);
        return;
      }

      await applyAction(member, settings);
      setActionCooldown(guild.id, member.id, settings.actionCooldownSeconds, nowMs);
      switchLogs.delete(`${guild.id}:${member.id}`);
    }
  } catch (error) {
    console.error('voiceStateUpdate error:', error.message);
  }
});

client.once('ready', () => {
  console.log(`Bot ready: ${client.user.tag}`);
});

if (!process.env.BOT_TOKEN) {
  throw new Error('Missing BOT_TOKEN in .env');
}

client.login(process.env.BOT_TOKEN);
