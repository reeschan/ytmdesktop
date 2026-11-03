`state-changed` から曲の変わり目に OS の通知を出す連携機能 (`general.showNotificationOnSongChange`)。

- 再生中で、前に通知した曲と ID が違うときだけ出す。
- 100×100 より大きい中で一番小さいサムネイルを `https.get` で取り、base64 にして通知のアイコンにする。取れなければアイコン無しで出す。
