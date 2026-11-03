`scripts/index.ts`。ページのスクリプトの入口。読み込まれた時点で `protectedapimanager.init()` と `ytmhook.init()` を呼び、`window` の `load` の後に次の順で準備する。各段が終わると `YTMViewSetupCompletionFlags` のビットを立てる。

1. **Early**: `ytmhook.ready()` を待ち、`window.__YTMD_HOOK__ = Object.freeze({ ytmPlayerController, ytmStateStore })` を置く。
2. **Styles**: `createStyleSheet()` で `<style>` を足し、Material Symbols の `<link>` を足して読み込みを待つ。
3. **Navigation**: `createNavigationMenuArrows()` で戻る・進むの矢印を足す。
4. **Hooks**: `waitForYTMPlayerApiReady()` の後に `initPlayerStateStore()`。
5. 背景動画 (`initBackgroundVideo`) と曲の聞き取りのボタン (`createSongRecognitionButton`)。どちらも任意の機能なので、失敗しても try/catch で先へ進み、フラグも持たない。
6. **Remote**: `initRemote()`。
7. **Extras**: 履歴ボタンの表示、Chromecast ボタンを隠す、プレイヤーバーのボタンを足す、時間付き歌詞。

途中で例外が出たら `{ op: "ytmd-errored", error }` を、最後に必ず `{ op: "ytmd-ready", completions }` を `window.postMessage(..., "/")` する。main は ready で Ready にし、エラーを受けていれば、立ったフラグ (OK) と立たなかったフラグ (FAIL) を Hook Error のダイアログに出す。
