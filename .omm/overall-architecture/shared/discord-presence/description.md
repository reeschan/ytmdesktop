Discord のアクティビティを組む純関数 (`activity.ts`) とテスト (`activity.test.ts`、vitest)。

- 型と定数: `DiscordActivity`・`DiscordActivityType`・`DiscordActivityStatusDisplayType` (Name 0 / State 1 / Details 2)、差し込み項目 `TemplateField` (`title`・`artist`・`album`)、`PresenceDisplaySettings` と既定値 `DEFAULT_PRESENCE_DISPLAY_SETTINGS` (`{title}` / `{artist}` / `{album}`、ボタンあり、State)。
- `buildActivity(settings, input)`: 表示テンプレートの `{field}` を埋めて (知らない項目はそのまま残す) 前後の空白を除き、2〜128 文字に合わせる (長ければ末尾を `...`、短ければゼロ幅空白で埋める)。1 行目が空なら曲名、他の欄が空なら省く。種類は Listening、再生中だけ開始・終了の時刻を付ける。ジャケットは一番大きい画像で、URL が 256 文字を超えたら `ytmd-logo`。小さい画像は再生 / 一時停止。ボタン「Play on YTMDesktop」(`ytmd://play/<id>`) は設定で出し入れする。
- import 元: `src/main/integrations/discord-presence/` (本体と `minimal-discord-client/types.ts`)、`src/main/services/configstore` (既定値)、設定のアプリ画面。
