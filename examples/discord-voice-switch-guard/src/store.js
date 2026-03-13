const Database = require('better-sqlite3');

const db = new Database(process.env.DB_PATH || './guard.db');

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  window_seconds INTEGER NOT NULL DEFAULT 10,
  max_switches INTEGER NOT NULL DEFAULT 3,
  action TEXT NOT NULL DEFAULT 'mute',
  action_role_id TEXT NOT NULL DEFAULT '',
  mute_duration_seconds INTEGER NOT NULL DEFAULT 300,
  action_cooldown_seconds INTEGER NOT NULL DEFAULT 120,
  ignore_bots INTEGER NOT NULL DEFAULT 1,
  whitelist_role_ids TEXT NOT NULL DEFAULT '[]',
  unverified_only INTEGER NOT NULL DEFAULT 0,
  unverified_role_ids TEXT NOT NULL DEFAULT '[]'
);
`);

function ensureColumn(name, sql) {
  const cols = db.prepare('PRAGMA table_info(guild_settings)').all();
  if (!cols.some((col) => col.name === name)) {
    db.exec(`ALTER TABLE guild_settings ADD COLUMN ${sql}`);
  }
}

ensureColumn('unverified_only', "unverified_only INTEGER NOT NULL DEFAULT 0");
ensureColumn('unverified_role_ids', "unverified_role_ids TEXT NOT NULL DEFAULT '[]'");
ensureColumn('action_cooldown_seconds', 'action_cooldown_seconds INTEGER NOT NULL DEFAULT 120');
ensureColumn('action_role_id', "action_role_id TEXT NOT NULL DEFAULT ''");

const upsertDefaultStmt = db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)');
const getStmt = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?');
const setStmt = db.prepare(`
INSERT INTO guild_settings (
  guild_id, enabled, window_seconds, max_switches, action,
  action_role_id, mute_duration_seconds, action_cooldown_seconds, ignore_bots, whitelist_role_ids,
  unverified_only, unverified_role_ids
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(guild_id) DO UPDATE SET
  enabled = excluded.enabled,
  window_seconds = excluded.window_seconds,
  max_switches = excluded.max_switches,
  action = excluded.action,
  action_role_id = excluded.action_role_id,
  mute_duration_seconds = excluded.mute_duration_seconds,
  action_cooldown_seconds = excluded.action_cooldown_seconds,
  ignore_bots = excluded.ignore_bots,
  whitelist_role_ids = excluded.whitelist_role_ids,
  unverified_only = excluded.unverified_only,
  unverified_role_ids = excluded.unverified_role_ids
`);

function rowToSettings(row) {
  return {
    guildId: row.guild_id,
    enabled: !!row.enabled,
    windowSeconds: row.window_seconds,
    maxSwitches: row.max_switches,
    action: row.action,
    actionRoleId: row.action_role_id || '',
    muteDurationSeconds: row.mute_duration_seconds,
    actionCooldownSeconds: row.action_cooldown_seconds,
    ignoreBots: !!row.ignore_bots,
    whitelistRoleIds: JSON.parse(row.whitelist_role_ids || '[]'),
    unverifiedOnly: !!row.unverified_only,
    unverifiedRoleIds: JSON.parse(row.unverified_role_ids || '[]')
  };
}

function getGuildSettings(guildId) {
  upsertDefaultStmt.run(guildId);
  return rowToSettings(getStmt.get(guildId));
}

function setGuildSettings(guildId, settings) {
  setStmt.run(
    guildId,
    settings.enabled ? 1 : 0,
    settings.windowSeconds,
    settings.maxSwitches,
    settings.action,
    settings.actionRoleId || '',
    settings.muteDurationSeconds,
    settings.actionCooldownSeconds,
    settings.ignoreBots ? 1 : 0,
    JSON.stringify(settings.whitelistRoleIds || []),
    settings.unverifiedOnly ? 1 : 0,
    JSON.stringify(settings.unverifiedRoleIds || [])
  );
  return getGuildSettings(guildId);
}

module.exports = {
  getGuildSettings,
  setGuildSettings
};
