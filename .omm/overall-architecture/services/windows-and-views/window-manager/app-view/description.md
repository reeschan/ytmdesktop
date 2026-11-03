`WebContentsView` を包むクラス `AppView` (`src/main/services/windowmanager/appview.ts`)。`EventEmitter`。YTM 画面・背景動画・`src/main/index.ts` の読み込み画面 (`mainView`) が使う。

- `_attachToWindow(window, index)` で親の `contentView.addChildView(view, index)` に付ける。インデックス 0 は最も下、省略は最も上。
- `viewState.autoResize` で親ウィンドウの `resize` に合わせて幅・高さを追従させ、`offsetHeight` (`anchor: "Bottom"`, `pixels: 36` など) でタイトルバーの分を空ける。`setAutoResize` で後から変えられる。
- レンダラーが落ちたとき `autoRecreate` なら作り直して同じ親・同じインデックスに付け直し、`recreated` を出す。`dom-ready` で `ready` を出す。
- `hide(true)` はビューに `appView:hide` を送り、ビューから `appView:hide` が返ってから非表示にする。`show(true)` は `appView:show` を送ってから表示する。
- webContents のイベント (移動・リダイレクト・全画面・右クリック・応答なし・読み込み失敗など) を `webcontents-*` として中継し、`ipc-message` を `ipcOn` のリスナーへ流す。
