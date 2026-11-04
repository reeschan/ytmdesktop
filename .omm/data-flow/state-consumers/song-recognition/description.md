曲の聞き取りの連携機能。音の元が「PC の音」で YTM が再生中なら、録る間だけ一時停止して後で戻す。そのために、録音の前後だけ `state-changed` を聞いて `trackState` を見る (ふだんは聞かない)。

- 再生中かは `getState().trackState` (`Playing` / `Buffering`) で決める。
- 一時停止と再開は `RemoteControl` の `pause` / `play` で送る。
