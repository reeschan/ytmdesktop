API のコマンドを `RemoteControl` の `execute` に変える関数。

- そのまま渡す: `playPause`・`play`・`pause`・`volumeUp`・`volumeDown`・`mute`・`unmute`・`next`・`previous`・`shuffle`・`toggleLike`・`toggleDislike`
- 値を確かめて渡す: `setVolume` (0〜100、外れれば `INVALID_VOLUME`)、`seekTo` (0〜曲の長さ、`INVALID_SEEK_POSITION`)、`playQueueIndex`・`queueRemove`・`queueMove` (今のキューの長さと比べて `INVALID_QUEUE_INDEX`)、`queueAdd` (`videoId` と `playlistId` のどちらか一方だけ、`INVALID_QUEUE_ADD_REQUEST`)
- 値を変えて渡す: `repeatMode` (`RepeatMode` を YTM の `"NONE"` / `"ALL"` / `"ONE"` に、ほかは `INVALID_REPEAT_MODE`)、`changeVideo` → `navigate` (`watchEndpoint`、どちらも無ければ `INVALID_CHANGE_REQUEST`)
