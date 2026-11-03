メインプロセス・アプリ画面・YTM 画面のスクリプトのどれからも import する、型と純関数 (`~shared` の別名で import する)。Electron の API を呼ばないので、vitest (`vitest.config.mts`、`src/**/*.test.ts`、node 環境) でそのまま試せる。

- テストがあるもの: `background-video`・`discord-presence/activity`・`theme`・`song-recognition` の audio / response / source / state。
- テストが無いもの: 型だけのファイル (`store/schema.ts`・`playerstatestore/types.ts`・`integrations/companion-server/types.ts`・`types.ts`) と `song-recognition/index.ts` (定数と型)。
