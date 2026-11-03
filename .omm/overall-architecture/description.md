YouTube Music Desktop App (reeschan のフォーク) の全体像。Electron 45 + Vue 3 + Vite 8 (electron-forge, pnpm) で作られ、YouTube Music のページ (YTM 画面) を WebContentsView で開き、その上にアプリ画面 (タイトルバー・設定・ミニプレイヤーなど) と連携機能 (Discord・Last.fm・Companion Server・曲の聞き取りなど) を足す。

- メインプロセス: `src/main/index.ts` が必須の Service を ServiceHost で起動し、任意の Integration を IntegrationManager に登録する。
- レンダラー: アプリ画面 (`src/renderer/windows/`) と、YTM 画面に差し込むスクリプト (`src/renderer/ytmview/`) の 2 種類。
- 共有: `src/shared/` に型と、テストのある純関数 (テーマ・背景動画・曲の聞き取りなど) を置く。
