`ConfigStore` の `integrations.companionServerAuthTokens`。トークンの hash などの配列を暗号化した hex。ここに書くと `ConfigStore` の変更通知が走り、CompanionServer は一覧に無くなった tokenId の Socket.IO の接続を切る。
