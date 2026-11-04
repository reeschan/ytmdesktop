`ConfigStore` が出す変更通知。この図の入力として置く。

- `onDidChange(<キー>, (newState, oldState) => ...)`: そのキーの値 (例: `appearance` の中身全体) の新旧を渡す。
- `onDidAnyChange((newState, oldState) => ...)`: 設定全体の新旧を渡す。
- どちらも解除用の関数を返す。Integration は無効化のときにそれを呼んで聞くのをやめる。
