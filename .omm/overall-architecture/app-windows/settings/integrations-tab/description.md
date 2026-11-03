`integrations.*` と `lastfm.*` の設定。

- Companion Server: オン・オフ、ブラウザからの通信 (CORS ワイルドカード)、認可の受け付け (`companionServerAuthWindowEnabled` は memoryStore に置く)、認可済みのアプリの一覧と削除。トークンの一覧は `safeStorage` で暗号化した文字列として保存し、safeStorage が使えないときは扱わない。
- Discord: オン・オフ、表示テンプレート 3 つ (1 行目・2 行目・ジャケットの説明文)、ボタンの有無、メンバー一覧での出し方。`buildActivity` (`~shared/discord-presence/activity`) と `getPlayerState` / `onPlayerStateChanged` で、今の曲 (無ければ見本の曲) のプレビューを出す。
- Last.fm: オン・オフ、認証 (`lastFMStepAuthenticate`)・ログアウト、スクロブルする再生割合。
- Enhanced media service。
- Shazam (曲の聞き取り): オン・オフ、API Key (`safeStorage.encryptString` で暗号化して保存)、音の元。音の元の選択肢は memoryStore の `songRecognitionDevices` (main-view の録音側が出す) と、`isPcAudioAvailable(platform)` で決まる「PC の音」。
