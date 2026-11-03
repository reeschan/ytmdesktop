`window.ytmd` に次を出す。

- `memoryStore` (store-ipc の MemoryStore): `set` → `memoryStore:set`、`get` → `memoryStore:get` (invoke)、`onStateChanged` → `memoryStore:stateChanged` を受ける。
- `ytmViewStatusChanged(cb)`: `ytmView:statusChanged` を受ける (YTMViewStatus: Loading / Hooking / Ready など)。
- `ytmViewLoadError(cb)`: `ytmView:loadError` を受ける (`{ code, description }`)。
- `ytmViewReload()` → `ytmView:reload` (main が YTM 画面を再読み込みする)。
- `appViewHiding(cb)` / `appViewShowing(cb)`: `appView:hide` / `appView:show` を受ける。`appViewHide()` → `appView:hide` を送り返して、隠し終えたことを伝える。
