`src/main/index.ts` で作るトレイ。アイコンは OS で替え (Windows は `tray.ico`、macOS はテンプレート画像、Linux は `appearance.trayIconStyle` と OS の明暗で白か黒)、OS の明暗が変わると (`nativeTheme` の `updated`) 付け直す。メニューから表示の切り替え・再生操作・終了ができる。
