(外部) 同じ PC で動くクライアント。`\?\pipe\ytmdesktop-ipc` (Windows) か `$XDG_RUNTIME_DIR` などの下の `ytmdesktop-ipc` に接続し、SELECT_VERSION で `v1` を選ぶと `state-update` を受け取る。30 秒ごとに PING を送らないと切られる。認証は無い。
