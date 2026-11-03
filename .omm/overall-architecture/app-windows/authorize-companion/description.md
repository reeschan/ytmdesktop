Companion Server に新しいアプリが認可を求めたときに出す確認の画面。Companion Server の API (`src/main/integrations/companion-server/api/v1/`) が要求ごとに BrowserWindow を作り、`additionalArguments: [requestId, appName, code]` で渡す。`Index.vue` が `TitleBar` と `Auth.vue` を出し、`Auth.vue` がアプリ名とコードを見せて、許可・拒否を返す。

`window.ytmd` (preload) が出すもの (チャネル名に `requestId` が付く):
- `getAppName()` / `getCode()`: `process.argv` の末尾 3 つから読んだ値を返す。
- `sendResult(bool)` → `companionAuthorization:result:<requestId>`。
- `minimizeWindow` / `maximizeWindow` / `restoreWindow` / `closeWindow` → `companionWindow:<操作>:<requestId>`、`handleWindowEvents` → `companionWindow:stateChanged:<requestId>` を受ける。
