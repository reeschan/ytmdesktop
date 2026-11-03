テーマを読み込み、アプリ画面と YTM 画面に色を当てる Service (`ThemeManager`)。

- `appearance.theme` か `themeFilePath` が変わったとき、またテーマファイルを `fs.watchFile` (1 秒ごと) で見て変わったときに読み直す。解決は `~shared/theme` の `resolveTheme`。読めない色項目やファイルの欠落は `MemoryStore` (`themeUnreadableItems` / `themeFileMissing`) に出す。
- アプリ画面: `web-contents-created` で全 webContents を追い、`ytmd-app:` の画面の `dom-ready` ごとに `toCssVariables` の CSS を `:root:root` で `insertCSS` する (新しい方を入れてから古い方を外す)。タイトルバーのオーバーレイの色も合わせる。
- YTM 画面: YTM の CSS 変数と面の背景を色項目で上書きする CSS を `!important` で入れる。面のぼかしが 0 より大きいと、面をすりガラスにする規則を足す。入れ終わると `ytm-theme-applied` を出す。
- 色が変わると `colors-changed` を出す。
