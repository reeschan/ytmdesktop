YTM 画面に開く music.youtube.com のページそのもの (外部)。中身は YouTube Music (Google) が作り、アプリは手を入れない。

- YTMViewManager が WebContentsView (AppView 名 "YTM") に `https://music.youtube.com/` (「前回の続きから再生」が有効なら前回の URL) を開く。セッションの partition は本番が `persist:ytmview`、開発時が `persist:ytmview-dev` で、ログイン状態はここに残る。
- アプリはこのページに、preload とページのスクリプト (`src/renderer/ytmview/`) で DOM と CSS を足し、プレイヤーのコントローラーと状態ストアにフックする。テーマ・カスタム CSS・背景動画のための透明化は、main が `insertCSS` で入れる。
- YTMViewManager は YTM 画面のセッション (本番・開発時とも) で、このページに許す権限を全画面 (`fullscreen`) だけにしている。
