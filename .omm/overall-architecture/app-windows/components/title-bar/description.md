`TitleBar.vue`。アプリ画面の高さ 36px のタイトルバー。props でタイトル・アイコン (Material Symbols の名前か画像)・中央寄せと、ホーム (`ytmViewNavigateDefault`)・設定 (`openSettingsWindow`)・最小化・最大化のボタンの有無を受け、`app-buttons` スロットで画面ごとのボタンを足せる。

- `window.navigator.windowControlsOverlay.visible` が真 (OS のウィンドウボタンを重ねて出している) のときは、自前の最小化・最大化・閉じるボタンを出さない。
- `handleWindowEvents` で最大化・全画面を受け、全画面ではタイトルバーごと隠す。
- `isMainWindow` のときは memoryStore の `ytmViewUnresponsive` を見て、タイトルに " (Unresponsive)" を付ける。
