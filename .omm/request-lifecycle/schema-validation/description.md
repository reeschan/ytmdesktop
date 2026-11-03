TypeBox のスキーマ (`api-shared/schemas.ts`) による本文の検証。Fastify がハンドラーの前に確かめ、合わなければ 400 を返す。

- `APIV1RequestCodeBody`: `appId` (`^[a-z0-9_\-]{2,32}$`)・`appName` (2〜48 文字)・`appVersion` (SemVer)
- `APIV1RequestTokenBody`: `appId` と `code` (`^[0-9]{4}$`)
- `APIV1CommandRequestBody`: `command` ごとの Union。`setVolume` は 0〜100、`seekTo` は 0 以上などの範囲も持つ。
- `/state` と `/playlists` には本文のスキーマが無い。
