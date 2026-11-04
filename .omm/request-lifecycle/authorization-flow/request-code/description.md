`POST /api/v1/auth/requestcode`。受付が閉じていれば `AUTHORIZATION_DISABLED` (403)。開いていれば `getTemporaryAuthCode` でコードを作って `{ code }` を返す。3 秒以内に空きのコードが作れなければ `AUTHORIZATION_TIME_OUT` (504)。
