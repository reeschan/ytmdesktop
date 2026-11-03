OS のメディア操作 (xosms の `MediaPlayer`) に再生中の曲を出し、OS 側の操作を YTM 画面に返す `EnhancedMediaService`。有効にする設定は `integrations.enhancedMediaServiceEnabled`。

- `onSetup` (app の ready 前): 設定が有効なら Chromium の `MediaSessionService` を `--disable-features` で切り、YTM 画面の標準のメディアセッションと重ならないようにする。
- `onEnabled`: `xosms` を動的 import して `MediaPlayer("ytmdesktop", "YTMDesktop")` を作り `activate()`。`PlayerStateStore` の `state-changed` で、曲名・アーティスト・アルバム・ID・再生状態・ジャケット・長さと位置・音量・シャッフル・リピートのうち変わったものだけ入れて `update()`。
- OS からのボタン・位置の変更・シーク・ループ・シャッフル・音量を、`ProtectedAPIManager` の `RemoteControl` API の `execute` に変えて送る。音量は Linux だけ 0〜1 と 0〜100 を変換する。
- `onDisabled`: `deactivate()` してリスナーを外す。
