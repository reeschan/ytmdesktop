IPC サーバーにつながった 1 つの接続を表す小さなクラス `CompanionServerIpcClient`。`net.Socket` と、SELECT_VERSION で選ばれた API の版 (`version`、未選択は `null`) だけを持つ。版が選ばれた接続にだけ状態を流す。
