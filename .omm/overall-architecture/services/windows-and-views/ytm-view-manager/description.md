YTM 画面 (music.youtube.com) を出す `AppView` を作って管理する Service (`src/main/services/ytmviewmanager/index.ts`)。`EventEmitterService`。依存は ConfigStore・StateManager・MemoryStore・AppWindowManager。

- `createView()` は `src/main/index.ts` が PostInitialized の後に呼ぶ。`playback.continueWhereYouLeftOff` なら `state.lastUrl` (music.youtube.com のときだけ) を開く。ビューは `sandbox`・`contextIsolation`、partition はパッケージ版 `persist:ytmview` / 開発版 `persist:ytmview-dev`、preload は `renderer/windows/ytmview/preload.cjs`。上から 36px をタイトルバーに空け、HTML の全画面中だけ 0 にする。
- 状態 (`YTMViewStatus`): Loading → (music.youtube.com なら) Hooking → Ready、読み込み失敗で LoadFailed。Ready はビューの `ytmView:ready` を受けたとき。`ytmView:errored` でフックのエラーを持つ。
- 移動とリダイレクトは YouTube Music・同意画面・Google アカウントの範囲に限り、それ以外は止めて、google.com / youtube.com などだけ外部ブラウザで開く。新しいウィンドウは常に拒否。
- `persist:ytmview` の権限は `fullscreen` だけ許す。右クリックメニュー (リンクやコピー、開発者ツールが有効なら Inspect) を自前で出す。
- 移動のたびに StateManager へ `lastUrl` を渡し、応答なしを MemoryStore の `ytmViewUnresponsive` に書く。
- イベント: `status-changed`・`view-recreated`・`unresponsive`・`responsive`・`title-updated`・`load-errored`。
