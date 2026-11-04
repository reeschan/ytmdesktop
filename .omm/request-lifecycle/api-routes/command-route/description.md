`POST /api/v1/command`。本文は `APIV1CommandRequestBody` で確かめ済み。`sendCommand` が投げたエラーはそのまま返り、投げなければ `204 No Content` を返す。YTM 画面での実行の成否は待たない。
