`setup/song-recognition.ts`。曲の聞き取りのアイコンを YTM 画面の検索欄 (`ytmusic-search-box`) の後ろに置く (検索欄が無い古い UI では何もしない)。YTM 画面がするのは合図と表示だけで、録音と Shazam への問い合わせは main と main-view が行う (ADR 0003)。

- クリックか Enter / Space で `ytmd-song-recognition-press` を `window.postMessage` する (キーの押しっぱなしは 1 回だけ)。preload が `songRecognition:press` で main に送る。
- preload から `ytmd-song-recognition-state` (`visible` / `phase` / `message`) を受けて、アイコンの出し入れ・状態のクラス・知らせの文を変える。
- `ytmd-song-recognition-search` を受けたら、検索欄に文字を入れて `yt-navigate` (`searchEndpoint`) で検索する。
- 準備ができたら `ytmd-song-recognition-listening` を送り、preload に最後の state を送り直させる。受けるのは `event.source === window` のメッセージだけ。
