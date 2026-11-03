YTM 画面の再生を見張り、操作する Service のまとまり。ProtectedAPIManager (YTM 画面との MessagePort の窓口)・PlayerStateStore (再生状態)・ShortcutManager (グローバルショートカット)・TaskbarManager (Windows のサムバーと進捗) の 4 つ。

- YTM 画面のスクリプト (`src/renderer/ytmview/`) は MessagePort で名前付きの API (`PlayerState`・`RemoteControl` など) を ProtectedAPIManager に渡す。PlayerStateStore は `PlayerState` から再生状態を受け、ShortcutManager と TaskbarManager は `RemoteControl` に `execute` を送って YTM 画面を操作する。
- 外への依存: PlayerStateStore は AppWindowManager (タイトルと状態の送り先) と StateManager、ShortcutManager は ConfigStore と MemoryStore、TaskbarManager は ConfigStore と AppWindowManager。ProtocolManager と Integration も `RemoteControl` を使う。
