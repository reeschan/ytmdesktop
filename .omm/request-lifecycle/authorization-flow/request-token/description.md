`POST /api/v1/auth/request`。確かめる順: 認可の画面が 5 つ以上なら `AUTHORIZATION_TOO_MANY` (503) → 受付が閉じていれば `AUTHORIZATION_DISABLED` (403) → コードが合わなければ `AUTHORIZATION_INVALID` (400)。

通れば `requestId` (UUID) を作って認可の画面を開き、返事・画面を閉じる操作・30 秒の時間切れ・クライアントの切断のどれかを待つ。許可ならトークンを発行して `{ token }` を返し、受付を閉じる。それ以外は `AUTHORIZATION_DENIED` (403)。
