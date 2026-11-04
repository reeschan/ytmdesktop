`state-changed` を OS のメディアの表示 (`xosms` の `MediaPlayer`) に写す連携機能。

- 曲名・アーティスト・アルバム・一番大きいサムネイル・長さ・位置・再生状態・音量・シャッフル・リピートを、前回の値と比べて変わったものだけ書き、`update()` する。
- 曲が無ければ `playbackStatus` を `stopped` にする。
- OS 側のボタンとシークは逆向きに `RemoteControl` へ送る (操作の送り手でもある)。
