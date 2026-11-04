`decideSongRecognition(state, event)`: 曲の聞き取りの状態 (段階・メッセージ・自分が一時停止したか `pausedByUs`) とイベントから、次の状態と実行する effect の一覧を返す純関数。

- Press: Idle / Message で使えるなら Recording へ (PC の音で再生中なら Pause も)。Recording 中なら取り消して Idle (自分が止めていれば Resume)。
- Recorded → Searching (Resume と Query)。RecordFailed → 「Audio source unavailable」のメッセージ。
- Result: 一致なら Search して Idle、違えばメッセージとタイマー。MessageExpired → Idle。
- UserPlayed (録音中に利用者が再生) → `pausedByUs` を偽にして後で再開しない。
- Disabled: 録音中なら取り消し (と Resume)、問い合わせ中なら AbortQuery。

テストは `state.test.ts` (vitest)。import 元は main の song-recognition の `index.ts` だけ。
