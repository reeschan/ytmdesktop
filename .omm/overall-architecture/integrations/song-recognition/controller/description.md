Integration 本体 `SongRecognition`。状態と effect の実行を持つ。

- `onEnabled`: いったんリスナーを外してから、`PlayerStateStore` の `state-changed`・`MemoryStore` の変更・`YTMViewManager` の `status-changed` を聞き、今の YTM 画面 (AppView) に `songRecognition:press` (ipcOn) と `ready` を付ける。YTM 画面が作り直されたら付け替える。
- 押されたとき: 設定 `integrations.shazamAudioSource` と `MemoryStore` の `songRecognitionDevices` から `resolveRecordSource` で音の元を決め、`Press` イベント (使えるか・PC の音か・再生中か) を `decideSongRecognition` に渡す。
- effect: StartRecording → `recordOnAppView`、Query → API キーを `safeStorage.decryptStringAsync` で戻して `detectSong`、Pause / Resume → `RemoteControl` API の `pause` / `play`、Search → YTM 画面に `songRecognition:search`、StartMessageTimer → 4 秒後に MessageExpired。
- 録音と問い合わせは世代番号を持ち、取り消し・置き換え・時間切れ (15 秒) の後に届いた結果は捨てる。
- 自分が送った pause / play が再生状態に届くまでの 2 秒間は、その変化を利用者の操作と見なさない。
- アイコンを出すか (`visible`) は、有効・API キーあり・`safeStorageAvailable` のすべてが真のとき。状態は `songRecognition:state` で YTM 画面に送る。
- mainView の webContents は、`index.ts` が `setAppViewContentsGetter` で渡す getter から毎回取る (作り直されうるため)。
