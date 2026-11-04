YTM 画面の検索欄の横に置く聞き取りのボタン (`createSongRecognitionButton`)。押すとページから `ytmd-song-recognition-press` を `postMessage` し、preload が `songRecognition:press` でメインプロセスへ送る (ページの main world からのものだけ)。

- メインプロセスから `songRecognition:state` (見せるか・段階・知らせの文) を受けて見た目を変える。
- `songRecognition:search` の文字列を検索欄に入れ、`yt-navigate` の `searchEndpoint` で検索する。
