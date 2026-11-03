Updater ウィンドウを閉じた後に作るトレイアイコンとメニュー。

- アイコン: Windows は `tray.ico`、macOS は `trayTemplate.png`、それ以外は `appearance.trayIconStyle` (Auto は `nativeTheme.shouldUseDarkColors` で白か黒) で `ytmd_white.png` / `ytmd_black.png`。開発時は `src/assets/icons`、パッケージ後は `process.resourcesPath` から読む。
- メニュー: Show/Hide Window (ミニプレイヤーがあれば閉じる)、Play/Pause・Previous・Next (`ProtectedAPIManager` の `RemoteControl` に `execute` を送る)、Quit。
- クリックでメインウィンドウを `showAndFocus()`。
- `nativeTheme` の `updated` でアイコンを差し替える。
