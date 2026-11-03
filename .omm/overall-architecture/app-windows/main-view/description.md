メインウィンドウの一番上に重なる、透明な WebContentsView (`mainView`、AppView 名 "Main") の画面。Main ウィンドウを作るときに `views: [mainView]` で付き、YTM 画面のビューと背景動画のビューは後から index 0 (下) に差し込まれる。役目は 2 つある。

- ローディング画面: YTM 画面の準備ができるまで、その上にロゴと状態 ("Loading YouTube Music..." など) を出す。YTMViewManager が Ready になると main が `mainView.hide(true)` で隠し (画面はフェードしてから `appView:hide` を返す)、Ready 以外の状態・YTM 画面の作り直し・応答なし (unresponsive) のときは `mainView.show(true)` でまた出す。
- 曲の聞き取りの録音: 隠れている間も読み込まれたまま残るこの画面で、音の元 (マイク・入力デバイス・PC の音) を録る。YTM 画面には録音の権限を渡さない (ADR 0003)。

main 側では `transparent: true` / `sandbox: true` / `contextIsolation: true` で作り、上 36px をタイトルバーに空ける。`autoRecreate: true` なので、落ちても作り直され、YTM 画面が Ready ならまた隠される。
