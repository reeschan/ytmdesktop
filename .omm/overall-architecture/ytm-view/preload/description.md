`preload.ts`。isolated world で動き、ページのスクリプトと main の間を取り持つ。

- 読み込まれるとすぐ、束ねたページのスクリプト (`scripts?raw`) を `webFrame.executeJavaScript` で main world に入れる。
- `window` の `message` を待ち、次を main に送る。
  - `"ytmd-protected-api-port"` (最初の 1 回だけ) → `ipcRenderer.postMessage("protectedApi:bindPort", null, ports)`。
  - `op: "ytmd-ready"` → `ytmView:ready` (完了フラグ)。続けて store-ipc の Store で `state` / `playback` / `appearance` を読み、「前回の続きから再生」(前回の `lastVideoId` へ `yt-navigate`) と音量スライダーの常時表示 (`ytmd-persist-volume-slider` クラス、`onDidAnyChange` で追従) を行い、`ytmView:executeScript` のリスナーを付ける。
  - `op: "ytmd-errored"` → `ytmView:errored`。
  - 背景動画の `Report` → `backgroundVideo:ytmReport` (`available` / `reducedMotion` を真偽値に直す)。最初の報告で、先に届いていた state をページに送り直す。
  - 曲の聞き取りの `Press` (`event.source === window` のときだけ) → `songRecognition:press`。`Listening` を受けたら最後の state を送り直す。
- main からの `backgroundVideo:ytmState`・`songRecognition:state`・`songRecognition:search` を覚えておき、`window.postMessage` でページに渡す。
