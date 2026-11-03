更新後に一度だけ出る変更履歴の画面。設定の `metadata.appVersion` が今の版と違うときに main が開く。`Index.vue` が `TitleBar` と `Changelog.vue` を出し、`Changelog.vue` が `getReleaseMetadata()` のリリースノート (Markdown) を `markdown-it` (`html: true`, `linkify: true`) で描いて `v-html` で入れる。

`window.ytmd` (preload) が出すもの:
- ウィンドウ操作: `minimizeWindow` などと `handleWindowEvents` / `requestWindowState` (`windowControls:*`)。
- `store` (store-ipc の Store)。
- `getAppVersion` → `app:getVersion`、`getReleaseMetadata` → `changelog:getReleaseMetadata` (invoke)。main は更新の配信元 (`autoUpdater.getFeedUrlNoPlatform()` の `/win32/<版>`) から取ってくる。
