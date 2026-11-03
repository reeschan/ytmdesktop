`net.Socket` を包む `IPCClient`。フレームは「opcode (int32LE)・JSON の長さ (int32LE)・JSON」。OPCode は HANDSHAKE 0・FRAME 1・CLOSE 2・PING 3・PONG 4。

- `send(data, op = FRAME)`: socket が書ければ書く。書けなければ `end()` して socket を作り直す (そのメッセージは捨てる)。
- `data` の受け取りは 1 回の `data` に 1 フレームが入っている前提で読み、JSON が読めなければ捨てる。
- `close()` は CLOSE を送ってから `end()`、`destroy()` はリスナーを外して socket を壊す。
