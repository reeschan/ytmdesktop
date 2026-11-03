ページ内スクリプトの入口 (`scripts/index.ts`)。読み込まれた時点で `protectedapimanager.init()` と `ytmhook.init()` を呼び、`load` の後に段階ごとに準備を進める。

- 順番: フックの準備 (`Early`) → スタイル (`Styles`) → ナビゲーションの矢印 (`Navigation`) → プレイヤー API の準備を待って再生状態の送り出し (`Hooks`) → 背景動画と曲の聞き取りのボタン (失敗しても続ける) → `RemoteControl` (`Remote`) → その他 (`Extras`)
- 済んだ段階を `YTMViewSetupCompletionFlags` のビットで集め、最後に `ytmd-ready` (失敗時は先に `ytmd-errored`) を `window.postMessage` する。
