すべての連携機能の抽象基底クラス `Integration`。

- 子クラスが決めるもの: `name`、`storeEnableProperty` (on/off を決める設定のパス)、任意で `dependentStoreProperties` (変わったら再起動する設定のパス) と `disableFlags`。
- 子クラスが実装するもの: `onSetup` (app の ready 前、まだ無効)、`onEnabled` / `onDisabled` (いつも ready 後)。
- `IntegrationManager.SETUP` / `ENABLE` / `DISABLE` のシンボルのメソッドと `ServiceHost.INJECT` は `IntegrationManager` だけが呼ぶ。`isEnabled` は ENABLE / DISABLE で切り替わり、`onEnabled` が投げたときは偽に戻してから投げ直す。
- `getService(Service)` で ServiceHost から Service を取る。
- `executeYTMScript(script)` は YTM 画面に `ytmView:executeScript` を送る。YTM 画面の preload は `webFrame.executeJavaScript(script)` の戻り値を関数として呼ぶので、スクリプトは関数式で書く。
