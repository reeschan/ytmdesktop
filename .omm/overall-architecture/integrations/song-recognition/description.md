曲の聞き取り。YTM 画面のアイコンが押されたら、音の元を 5 秒録り、Shazam (RapidAPI) に曲名とアーティストを問い合わせ、結果を YTM 画面の検索欄で検索する。有効にする設定は `integrations.shazamEnabled`、API キー `integrations.shazamApiKey` (safeStorage で暗号化) が変わると再起動する。

- 録音は YTM 画面ではなく、隠れているアプリ画面 mainView (`src/renderer/windows/main/song-recognition-recorder.ts` の録音器) で行う (`docs/adr/0003-song-recognition-outside-ytm-view.md`)。
- 状態の遷移 (Idle → Recording → Searching → Message) は `src/shared/song-recognition/state.ts` の純関数 `decideSongRecognition` が決め、この Integration は返った effect (録音・問い合わせ・一時停止・再開・検索・メッセージのタイマー) を実行する。
- PC の音を録るときに YTM が再生中なら一時停止し、録り終えたら再開する。録音中に利用者が自分で再生したら、後で再開はしない。録音中にもう一度押すと取り消す。
- 仕様は `docs/specs/song-recognition.md`。
