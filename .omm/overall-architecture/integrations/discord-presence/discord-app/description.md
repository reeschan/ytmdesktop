(外部) PC で動いている Discord クライアント。ローカルの IPC (`discord-ipc-N` の名前付きパイプか UNIX ソケット) で HANDSHAKE と `SET_ACTIVITY` を受け、利用者のプロフィールに「Listening」のアクティビティとして出す。Discord が起動していなければ接続は失敗する。
