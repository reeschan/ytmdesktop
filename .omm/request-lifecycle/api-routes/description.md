認証を通った後のハンドラー (`/state`・`/playlists`・`/command`)。再生状態を読むか、`RemoteControl` に操作を送る。`/command` は `sendCommand` が値を確かめ、`execute` のコマンドに変える。
