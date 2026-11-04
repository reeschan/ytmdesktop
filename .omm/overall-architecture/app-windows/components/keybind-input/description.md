`KeybindInput.vue`。押したキーの組み合わせを Electron の accelerator 形式の文字列 (`Meta+` / `CmdOrCtrl+` / `Alt+` / `Shift+` + キー) にして、v-model と `change` で返す。修飾キーだけの入力は受けず、Escape で取り消す。設定画面の Shortcuts タブで使う。
