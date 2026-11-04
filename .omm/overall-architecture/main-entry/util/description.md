メインプロセスの小さな関数。

- `assetFolder` / `getIconPath(icon)` / `getControlsIconPath(icon)`: 開発時は `src/assets/icons/` (controls は `icons/controls/`)、パッケージ後は `process.resourcesPath` 直下のアイコンのパス。
- `v1ConfigMigration(configStore)`: userData の `.first-run` が無い初回起動だけ動く。隣の `youtube-music-desktop-app/config.json` (v1 の設定) を読み、ダイアログで聞いてから、Companion Server・続きから再生・カスタム CSS (v1 の `page.css` を `custom_css.css` にコピー)・音量カーブ・Discord・拡大率・トレイに隠す・通知・起動時の動作・スピーカーフィル・ショートカットを v2 の設定に写す。Last.fm は写さず、再認証が要ると知らせる。
