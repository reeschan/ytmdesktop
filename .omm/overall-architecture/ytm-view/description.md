YTM 画面 (music.youtube.com を開いた WebContentsView、AppView 名 "YTM") に差し込むコード。YTMViewManager (`src/main/services/ytmviewmanager/`) がビューを `sandbox: true` / `contextIsolation: true` で作り、この preload を入れる。

2 つの層に分かれる。

- **preload** (`preload.ts`、isolated world): Electron の `ipcRenderer` / `webFrame` を持つ。ページの中で動くスクリプトと main の間を取り持つ。
- **ページのスクリプト** (`scripts/`、main world): YouTube Music のページと同じ世界で動き、プレイヤーと状態ストアにフックし、DOM と CSS を足す。`ipcRenderer` は持たず、`window.postMessage` と MessagePort だけで外とやりとりする。

`scripts/` は Vite のプラグイン `iife-ytmview-scripts` (`config/vite/preload/ytmview.ts`) が `scripts/index.ts` から 1 つの IIFE に束ね、preload に文字列として埋め込む (`import scriptsRaw from "./scripts?raw"`)。preload は読み込まれるとすぐ `webFrame.executeJavaScript(scriptsRaw)` で main world に入れる。

main に届く道は 3 つ。
1. **Protected API** (主な道): ページが `MessageChannel` を作り、`window.postMessage("ytmd-protected-api-port", "/", [port2])` で投げる。preload がそれを受けて `ipcRenderer.postMessage("protectedApi:bindPort", null, ports)` で main の ProtectedAPIManager に渡す。以降は API ごとに別のポート (`PlayerState` / `RemoteControl`) で、`Message` / `Invoke` / `InvokeResponse` をやりとりする。
2. **window.postMessage → preload → ipcRenderer**: セットアップの完了 (`ytmd-ready` → `ytmView:ready` に完了フラグを付けて)、エラー (`ytmd-errored` → `ytmView:errored`)、背景動画の報告 (`backgroundVideo:ytmReport`)、曲の聞き取りのアイコンが押された合図 (`songRecognition:press`)。
3. **main → preload → ページ**: `backgroundVideo:ytmState`・`songRecognition:state` / `songRecognition:search` を preload が `window.postMessage` でページに渡す。

main がページでスクリプトを動かすときは、Integration の `executeYTMScript(script)` が `ytmView:executeScript` を送り、preload が `(await webFrame.executeJavaScript(script))()` で実行する (スクリプトは関数を返す式で書く)。このリスナーは `ytmd-ready` を受けてから登録する。今これを使うのは volume-ratio の Integration。
