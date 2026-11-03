この図の外側にあるメインプロセス。YTM 画面のスクリプトから見た相手として置く。

- `ProtectedAPIManager` が `protectedApi:bindPort` と API ごとのポートを受ける。
- `YTMViewManager` が `ytmView:ready` / `ytmView:errored` を受けて状態を進める。
- `Integration.executeYTMScript` が `ytmView:executeScript` を送る。BackgroundVideoManager と SongRecognition がそれぞれの状態を送る。
