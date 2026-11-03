各画面の preload が `contextBridge.exposeInMainWorld("ytmd", ...)` で出す `window.ytmd`。コンポーネントは、組み込まれた画面の preload が必要なメソッド (TitleBar ならウィンドウ操作と memoryStore、YTMViewLoading なら YTM 画面の状態の購読) を出している前提で呼ぶ。
