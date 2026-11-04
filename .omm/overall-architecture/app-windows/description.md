アプリ画面 (アプリが自分で作る画面) のレンダラー側。`src/renderer/windows/` の 8 つの画面と、共通の Vue コンポーネント (`src/renderer/components/`)、設定と状態の IPC ラッパー (`src/renderer/store-ipc/`) からなる。

- 各画面は `index.html` + `preload.ts` + `renderer.ts` + Vue SFC (`Index.vue` など) の組。`renderer.ts` が `createApp(Index.vue).mount("#app")` する。
- `preload.ts` は `contextBridge.exposeInMainWorld("ytmd", {...})` で `window.ytmd` を出す。Vue 側は `ipcRenderer` を直接触らず、`window.ytmd` だけを呼ぶ。
- 本番は `ytmd-app://<画面名>` (ProtocolManager が `.vite/renderer/windows/<画面名>` を配る)、開発時は `ALL_WINDOWS_VITE_DEV_SERVER_URL + /windows/<画面名>/index.html` から読み込む。
- メインウィンドウは titlebar の BrowserWindow に、下から background-video のビュー、YTM 画面のビュー、main のビュー (ローディング画面) を重ねたもの。ビューは上 36px をタイトルバーに空ける。
- 見た目: 各 SFC の `<style scoped>` に、Tailwind v4 のユーティリティ (`tw:` 接頭辞、例 `tw:bg-ytmd-background`) を足して色を当てる。`src/assets/app.css` が `src/assets/theme.css` を読み込み、theme.css は preflight なしで Tailwind の theme / utilities 層だけを入れ、`--color-ytmd-*` を main が注入する `--ytmd-color-*` (テーマの色項目) に向ける。アイコンは `material-symbols` のフォント。
