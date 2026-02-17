require('dotenv').config();

const express = require('express');
const session = require('express-session');
const { setGuildSettings, getGuildSettings } = require('./store');

const app = express();

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  SESSION_SECRET,
  PORT = 3000
} = process.env;

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI || !SESSION_SECRET) {
  throw new Error('Missing DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET / DISCORD_REDIRECT_URI / SESSION_SECRET in .env');
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
}));

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

app.get('/auth/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: DISCORD_REDIRECT_URI,
    scope: 'identify guilds'
  });

  return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  const tokenResp = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI
    })
  });

  if (!tokenResp.ok) {
    return res.status(500).send('Token exchange failed');
  }

  const tokenData = await tokenResp.json();

  const [userResp, guildResp] = await Promise.all([
    fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    }),
    fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })
  ]);

  if (!userResp.ok || !guildResp.ok) {
    return res.status(500).send('Failed to load Discord profile');
  }

  const user = await userResp.json();
  const guilds = await guildResp.json();

  req.session.user = {
    id: user.id,
    username: user.username,
    guilds: guilds.filter((g) => g.owner).map((g) => ({ id: g.id, name: g.name }))
  };

  return res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/', requireLogin, (req, res) => {
  const guildRows = req.session.user.guilds.map((guild) => {
    const settings = getGuildSettings(guild.id);
    return { guild, settings };
  });

  const sections = guildRows.map(({ guild, settings }) => `
    <section style="border:1px solid #ddd;padding:16px;margin-bottom:16px;">
      <h3>${escapeHtml(guild.name)} (${escapeHtml(guild.id)})</h3>
      <form method="post" action="/guilds/${escapeHtml(guild.id)}/settings">
        <label><input type="checkbox" name="enabled" ${settings.enabled ? 'checked' : ''}/> 啟用</label><br/>
        <label>秒數窗：<input type="number" min="1" max="120" name="windowSeconds" value="${settings.windowSeconds}" /></label><br/>
        <label>最大切換次數：<input type="number" min="1" max="20" name="maxSwitches" value="${settings.maxSwitches}" /></label><br/>
        <label>動作：
          <select name="action">
            <option value="mute" ${settings.action === 'mute' ? 'selected' : ''}>mute</option>
            <option value="kick" ${settings.action === 'kick' ? 'selected' : ''}>kick</option>
            <option value="ban" ${settings.action === 'ban' ? 'selected' : ''}>ban</option>
            <option value="add_role" ${settings.action === 'add_role' ? 'selected' : ''}>add_role（加身分組）</option>
          </select>
        </label><br/>
        <label>禁言秒數（action=mute 時）：<input type="number" min="10" max="86400" name="muteDurationSeconds" value="${settings.muteDurationSeconds}" /></label><br/>
        <label>處置身分組 ID（action=add_role 時必填）：<input style="width:100%" name="actionRoleId" value="${escapeHtml(settings.actionRoleId || '')}" /></label><br/>
        <label>處置冷卻秒數（避免短時間重複處罰）：<input type="number" min="10" max="3600" name="actionCooldownSeconds" value="${settings.actionCooldownSeconds}" /></label><br/>
        <label><input type="checkbox" name="ignoreBots" ${settings.ignoreBots ? 'checked' : ''}/> 忽略 Bot</label><br/>
        <label><input type="checkbox" name="unverifiedOnly" ${settings.unverifiedOnly ? 'checked' : ''}/> 只處理未認證成員</label><br/>
        <small>未認證判定：Discord 內建 pending（未完成 Membership Screening）或下方「未認證角色 ID」命中。</small><br/>
        <label>白名單角色 ID（逗號分隔）：<br/>
          <input style="width:100%" name="whitelistRoleIds" value="${escapeHtml(settings.whitelistRoleIds.join(','))}" />
        </label><br/>
        <label>未認證角色 ID（逗號分隔，可空白）：<br/>
          <input style="width:100%" name="unverifiedRoleIds" value="${escapeHtml((settings.unverifiedRoleIds || []).join(','))}" />
        </label><br/>
        <button type="submit">儲存</button>
      </form>
    </section>
  `).join('');

  res.send(`
    <html><body style="font-family:sans-serif;max-width:860px;margin:20px auto;">
      <h1>Discord Voice Switch Guard</h1>
      <p>登入者：${escapeHtml(req.session.user.username)} (${escapeHtml(req.session.user.id)})</p>
      <a href="/logout">登出</a>
      <hr/>
      ${sections || '<p>你沒有擁有任何伺服器。</p>'}
    </body></html>
  `);
});

app.post('/guilds/:guildId/settings', requireLogin, (req, res) => {
  const { guildId } = req.params;
  const isOwner = req.session.user.guilds.some((guild) => guild.id === guildId);
  if (!isOwner) return res.status(403).send('forbidden');

  const action = req.body.action;
  if (!['mute', 'kick', 'ban', 'add_role'].includes(action)) return res.status(400).send('invalid action');

  const windowSeconds = Number(req.body.windowSeconds);
  const maxSwitches = Number(req.body.maxSwitches);
  const muteDurationSeconds = Number(req.body.muteDurationSeconds);
  const actionCooldownSeconds = Number(req.body.actionCooldownSeconds);
  const actionRoleId = String(req.body.actionRoleId || '').trim();

  if (Number.isNaN(windowSeconds) || windowSeconds < 1 || windowSeconds > 120) {
    return res.status(400).send('windowSeconds out of range');
  }
  if (Number.isNaN(maxSwitches) || maxSwitches < 1 || maxSwitches > 20) {
    return res.status(400).send('maxSwitches out of range');
  }
  if (Number.isNaN(actionCooldownSeconds) || actionCooldownSeconds < 10 || actionCooldownSeconds > 3600) {
    return res.status(400).send('actionCooldownSeconds out of range');
  }
  if (action === 'add_role' && !actionRoleId) {
    return res.status(400).send('actionRoleId required when action=add_role');
  }

  const whitelistRoleIds = String(req.body.whitelistRoleIds || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const unverifiedRoleIds = String(req.body.unverifiedRoleIds || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  setGuildSettings(guildId, {
    enabled: !!req.body.enabled,
    windowSeconds,
    maxSwitches,
    action,
    actionRoleId,
    muteDurationSeconds: Number.isNaN(muteDurationSeconds) ? 300 : muteDurationSeconds,
    actionCooldownSeconds,
    ignoreBots: !!req.body.ignoreBots,
    unverifiedOnly: !!req.body.unverifiedOnly,
    whitelistRoleIds,
    unverifiedRoleIds
  });

  return res.redirect('/');
});

app.listen(Number(PORT), () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});
