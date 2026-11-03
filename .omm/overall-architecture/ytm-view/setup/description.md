`scripts/setup/`。YTM 画面に機能を足す関数の集まり。どれも main world で動き、`scripts/index.ts` (setup-sequence) が決まった順に 1 回ずつ呼ぶ。YTM の DOM と、ytmhook が横取りした `playerApi` / `ytmStateStore` を直接さわる。

- 色やテーマの CSS はここでは足さない。テーマ・カスタム CSS・背景動画のための透明化の CSS は、main (ThemeManager / custom-css の Integration / BackgroundVideoManager) が YTM 画面の webContents に `insertCSS` で入れる。
- 外とのやりとりは、RemoteControl の Protected API (remote) と、preload との `window.postMessage` (background-video・song-recognition) だけ。
