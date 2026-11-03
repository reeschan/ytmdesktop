`net` のソケットを包む低い層 (`IPCClient`)。送るときは op (`HANDSHAKE` / `FRAME` など) と JSON の長さを little-endian の 32bit で前に付け、受けたフレームを `data` (op, json) として出す。
