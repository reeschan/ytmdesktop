背景動画の元が「ローカルの動画ファイル」のときに、動画とマスクを出す WebContentsView の画面 (ADR 0001)。BackgroundVideoManager (`src/main/services/backgroundvideo/`) が作り、メインウィンドウの一番下 (`attachView(view, 0)`) に付ける。上 36px をタイトルバーに空け、`transparent: true` / `sandbox: true`。YTM 画面はこの間だけ背景を透明にして、下の動画を透かす。

- `Index.vue` は `<video muted loop playsinline>` とマスクの層だけを持つ。動画の `src` は `ytmd-app://` の背景動画ファイル用のホストのトークン付き URL で、main が渡す。
- マスクの色・濃さ (0〜100) と、動画のぼかしを state から当てる。ぼかしで端が透けないように、動画をぼかし量の 3 倍だけ窓の外へはみ出させる。
- `prefers-reduced-motion` か state の motion が Still なら、今のフレームで止める。
- `renderer.ts` は `app.css` を読み込まない (Vue をマウントするだけ)。

`window.ytmd` (preload) が出すもの:
- `onBackgroundVideoState(cb)`: `backgroundVideo:state` を受ける (playback / motion / src / maskOpacity / maskBlur / maskColor)。
- `requestBackgroundVideoState()` → `backgroundVideo:requestState` (マウント時に今の state を頼む)。
