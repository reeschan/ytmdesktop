曲の聞き取り (`SongRecognition`)。音の元が「PC の音」で YTM が再生中なら、録り始める前に `RemoteControl` に `pause` を、録り終えた後に `play` を送る。結果の検索は `RemoteControl` ではなく、YTM 画面の preload への IPC (`SongRecognitionIpc.Search`) で行う。
