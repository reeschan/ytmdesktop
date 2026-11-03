アプリの中をデータがどう流れるかを、3 本の流れで示す。

1. 再生状態: YTM 画面のプレイヤー API とストアの変化を、ページ内スクリプトが Protected API (MessagePort) の `PlayerState` でメインプロセスへ送る。`PlayerStateStore` がアプリの型に直して持ち、`state-changed` などのイベントで連携機能・タスクバー・アプリ画面へ配る。
2. 設定と見た目: 設定画面が store-ipc (`configStore:set`) で `ConfigStore` (conf) に書く。`onDidChange` / `onDidAnyChange` を聞く Service が、テーマの CSS・背景動画・カスタム CSS・ズームを YTM 画面とアプリ画面に当て、`IntegrationManager` が連携機能を有効化・無効化・再起動する。
3. 操作: トレイ・グローバルショートカット・タスクバーのボタン・ミニプレイヤー・Companion Server・OS のメディア操作・`ytmd://` が、Protected API の `RemoteControl` に `execute` を送り、YTM 画面の `setup/remote.ts` がプレイヤーを操作する。結果は 1 の流れで戻る。
