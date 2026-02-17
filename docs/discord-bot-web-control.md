# Discord Bot + 網頁控制台（可執行版本）

你要的功能已經做成可直接跑的範例，位置：

- `examples/discord-voice-switch-guard`

此範例提供：

- 10 秒內切換語音頻道超過 3 次自動處理
- 動作可在網頁設定為 `mute` / `kick` / `ban`
- 可切換為「只處理未認證成員」
- 由伺服器擁有者使用 Discord OAuth2 登入網頁控制台後設定

## 快速開始

```bash
git --version
cd <你的 BetterDiscord 路徑>/examples/discord-voice-switch-guard
npm install
cp .env.example .env
npm run start:bot
npm run start:dashboard
```

打開 `http://localhost:3000` 後即可登入與設定。

> Windows 使用者請直接用 PowerShell 執行，不需要先輸入 `bash`。

## 超新手教學

如果你是第一次接觸 Discord Bot，請直接看這份逐步教學：

- `examples/discord-voice-switch-guard/README.md`


## 大伺服器說明

3-5 萬人可以用，但建議依 README 的「3-5 萬人大伺服器建議」改成 Redis/監控架構再正式上線。


> 如果 `git` 指令不存在，先安裝 Git（Windows: Git for Windows），並重開終端機。


> 若 PowerShell `cd` 顯示找不到路徑，先在 `$HOME` 執行 `dir` 與 `Test-Path` 檢查實際資料夾名稱（可能是 `BetterDiscord-main`）。


> 不知道資料夾在哪：在 PowerShell 執行 `Get-ChildItem -Path $HOME -Directory -Recurse | Where-Object { $_.FullName -like "*discord-voice-switch-guard" }` 快速找路徑。

> 如果搜尋沒有任何結果，代表專案還沒下載到電腦；先 `git clone` 或 Download ZIP 再進入資料夾。
