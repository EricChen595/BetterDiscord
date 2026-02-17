# Discord Voice Switch Guard（超新手一步一步）

你要的功能是：

- 會員在**10 秒內**切換語音頻道**超過 3 次**就處理
- 處理方式可選：`mute` / `kick` / `ban`
- 可選「只處理未認證成員」
- 由伺服器擁有者在網頁改設定

> 先講重點：你只要照著下面「步驟 0 到步驟 8」做，就能跑起來。

---

## 步驟 0：你需要先準備什麼

1. 一台電腦（Windows / macOS / Linux 都可）
2. 已安裝 **Node.js 20+**（建議裝 LTS）
3. 一個 Discord 帳號
4. 一個你自己是「擁有者」的 Discord 伺服器

確認 Node 有安裝成功：

```bash
node -v
npm -v
```

如果有顯示版本號（例如 `v22.x.x`），就可以繼續。

再確認 Git 有安裝：

```bash
git --version
```

如果出現「`git` 不是內部或外部命令」(Windows) 或 `command not found`，請先安裝 Git：

- Windows：安裝 **Git for Windows**（https://git-scm.com/download/win）
- macOS：`xcode-select --install`（或 `brew install git`）
- Ubuntu/Debian：`sudo apt update && sudo apt install -y git`

安裝後請**關掉並重開終端機**再執行 `git --version`。

---

## 步驟 1：建立 Discord 應用程式 + Bot

1. 打開：https://discord.com/developers/applications
2. 按 **New Application**，輸入名稱（例如 `VoiceSwitchGuard`）
3. 左側進到 **Bot**
4. 按 **Reset Token**（或 Copy Token）拿到 `BOT_TOKEN`（先貼到記事本）

> `BOT_TOKEN` 很重要，不能給別人。

---

## 步驟 2：設定網頁登入（OAuth2）

1. 左側進到 **OAuth2** -> **General**
2. 找到 **CLIENT ID**，記下來（這是 `DISCORD_CLIENT_ID`）
3. 按 **Reset Secret** / Copy，記下來（這是 `DISCORD_CLIENT_SECRET`）
4. 在 **Redirects** 新增：
   - `http://localhost:3000/auth/callback`

---

## 步驟 3：邀請 Bot 到你的伺服器

1. 到 **OAuth2 -> URL Generator**
2. Scopes 勾選：`bot`
3. Bot Permissions 建議勾選：
   - `View Channels`
   - `Connect`
   - `Read Message History`（可選）
   - `Mute Members`（如果你要 mute）
   - `Kick Members`（如果你要 kick）
   - `Ban Members`（如果你要 ban）
4. 複製產生的 URL，用瀏覽器開啟，邀請到你的伺服器

> 另外要注意：Bot 角色要高於一般成員角色，不然可能無法 kick/ban/mute。

---

## 步驟 4：下載專案並進入範例資料夾（依你的作業系統）

## 我不知道什麼資料夾（1 分鐘找出來）

在 Windows PowerShell 直接貼上：

```powershell
cd $HOME
Get-ChildItem -Directory | Select-Object Name
Get-ChildItem -Path $HOME -Directory -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -like "*discord-voice-switch-guard" } |
  Select-Object -First 5 FullName
```

- 如果有看到 `...\BetterDiscord\examples\discord-voice-switch-guard`，就 `cd` 到那一行。
- 如果有看到 `...\BetterDiscord-main\examples\discord-voice-switch-guard`，就 `cd` 到那一行。
- 如果都沒有結果，代表你尚未下載專案（請回到步驟 4 用 `git clone` 或 Download ZIP）。

你遇到的錯誤是正常的：`/workspace/...` 是我這個雲端工作環境的路徑，不是你電腦的路徑。
另外你在 Windows PowerShell 直接打 `bash`，如果沒有安裝 WSL 也會失敗。

請用你自己的終端機 + 你自己的專案路徑：

### Windows（建議直接用 PowerShell，不要先打 `bash`）

```powershell
cd $HOME
git clone https://github.com/<你的帳號或fork>/BetterDiscord.git
cd .\BetterDiscord\examples\discord-voice-switch-guard
```

如果你還沒裝 Git，也可以先用下載 ZIP 的方式：

1. 開啟 `https://github.com/<你的帳號或fork>/BetterDiscord`
2. 按 `Code` -> `Download ZIP`
3. 解壓縮後，進入：
   `BetterDiscord-main\examples\discord-voice-switch-guard`

### 如果 `cd .\BetterDiscord\examples\discord-voice-switch-guard` 顯示「找不到路徑」

先不要急，通常是資料夾名稱不同。請先看目前有哪些資料夾：

```powershell
cd $HOME
dir
```

常見情況：

1. 你是用 ZIP 下載，資料夾會叫 `BetterDiscord-main`
   ```powershell
   cd .\BetterDiscord-main\examples\discord-voice-switch-guard
   ```
2. 你 clone 到別的名稱或路徑
   - 先用 `dir` 找到實際資料夾名稱，再 `cd` 進去
3. 根本還沒下載成功
   - 重新執行：
   ```powershell
   git clone https://github.com/<你的帳號或fork>/BetterDiscord.git
   ```

你也可以先測試路徑是否存在：

```powershell
Test-Path .\BetterDiscord\examples\discord-voice-switch-guard
Test-Path .\BetterDiscord-main\examples\discord-voice-switch-guard
```

哪個顯示 `True` 就用哪個 `cd`。

### macOS / Linux

```bash
cd ~
git clone https://github.com/<你的帳號或fork>/BetterDiscord.git
cd ~/BetterDiscord/examples/discord-voice-switch-guard
```

如果你已經下載在別的資料夾，請改成你實際路徑，例如：

- Windows: `cd D:\projects\BetterDiscord\examples\discord-voice-switch-guard`
- macOS/Linux: `cd /home/you/projects/BetterDiscord/examples/discord-voice-switch-guard`

---

## 步驟 5：安裝套件 + 建立設定檔

```bash
npm install
cp .env.example .env
```

Windows 小提醒（PowerShell）：如果 `cp` 不習慣，可改用：

```powershell
copy .env.example .env
```

打開 `.env`，把值填好：

```env
BOT_TOKEN=你的 Bot Token
DB_PATH=./guard.db

DISCORD_CLIENT_ID=你的 Client ID
DISCORD_CLIENT_SECRET=你的 Client Secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback
SESSION_SECRET=隨便一串長字串_例如_abc123xyz987
PORT=3000
```

---

## 步驟 6：啟動（要開兩個終端）

### 終端 A（跑 Bot）

```bash
cd <你的 BetterDiscord 路徑>/examples/discord-voice-switch-guard
npm run start:bot
```

看到類似 `Bot ready: xxx` 代表成功。

### 終端 B（跑網頁）

```bash
cd <你的 BetterDiscord 路徑>/examples/discord-voice-switch-guard
npm run start:dashboard
```

看到 `Dashboard running on http://localhost:3000` 代表成功。

Windows（PowerShell）可直接執行：

```powershell
cd <你的 BetterDiscord 路徑>\examples\discord-voice-switch-guard
npm run start:bot
# 另一個視窗再跑：
npm run start:dashboard
```

---

## 步驟 7：進入網頁設定

1. 開瀏覽器到 `http://localhost:3000`
2. 跳 Discord 登入就登入
3. 只會看到你是擁有者的伺服器
4. 在伺服器卡片設定：
   - `windowSeconds` 填 `10`
   - `maxSwitches` 填 `3`
   - `action` 選你要的（`mute` / `kick` / `ban`）
   - `actionCooldownSeconds` 建議先填 `120`（避免重複處罰）
   - 如果你只想管「未認證成員」，勾選 `只處理未認證成員`
   - 如果你伺服器有自訂身分組（例如「未認證成員」），把該角色 ID 填進 `未認證角色 ID`
5. 按「儲存」

---

## 步驟 8：實際測試

找一個測試帳號（不要用管理員）進語音，來回切頻道：

- 在 10 秒內切超過 3 次
- 應該會觸發你選的動作

如果沒觸發，先檢查：

1. Bot 有沒有在線上
2. Bot 權限是否足夠（Mute/Kick/Ban）
3. Bot 角色是否高於目標成員角色
4. 你是否把該成員角色放進白名單了

---



## 3-5 萬人大伺服器建議（很重要）

先直接講結論：**目前這份是可用範例，不是最終企業級架構**。

若你要上 3-5 萬人，建議至少做這些優化：

1. **多進程/多機器**時，將 `switchLogs` 與 cooldown 改成 Redis（現在是單機記憶體）。
2. 把 dashboard 的 session 改成 Redis store（避免單機記憶體 session 掉線）。
3. 啟用監控：CPU、記憶體、事件延遲、每分鐘處置數。
4. 建立 action log 與告警（避免誤封、可追查）。
5. 先用 `mute` 觀察 1-2 週，再開 `kick/ban`。

目前範例已做的優化：

- 設定快取（降低每次事件讀 SQLite）
- action cooldown（避免同人短時間重複處罰）
- 定時清理記憶體 Map（避免長期堆積）
- SQLite WAL 模式（提高讀寫吞吐）

## 補充：什麼叫「未認證成員」

這個範例把「未認證」定義為下列任一條件：

1. `member.pending === true`（Discord Membership Screening 尚未完成）
2. 擁有你在後台填入的「未認證角色 ID」

所以你可以同時支援：

- Discord 內建入服驗證
- 你自己手動驗證流程（用身分組標記）

## 你最常用的設定（直接照填）

- `windowSeconds = 10`
- `maxSwitches = 3`
- `action = mute`（建議先用 mute 測試）

---

## 檔案用途（看不懂可以先略過）

- `src/bot.js`：判定「是否切頻過快」與執行處置
- `src/dashboard.js`：網頁登入 + 設定頁
- `src/store.js`：把每個伺服器設定存在 SQLite

---

## 常見錯誤排查

### 1) `MODULE_NOT_FOUND`
代表你還沒安裝套件，回到專案資料夾跑：

```bash
npm install
```

### 2) OAuth 登入後 500
通常是 `.env` 的 `DISCORD_CLIENT_ID / SECRET / REDIRECT_URI` 填錯。

### 3) 有觸發但 kick/ban 失敗
通常是 Bot 權限不足或角色層級太低。

---

如果你要，我下一步可以直接幫你做「**雲端部署版**」（例如 Railway / Render），讓你不用一直開著自己電腦。
