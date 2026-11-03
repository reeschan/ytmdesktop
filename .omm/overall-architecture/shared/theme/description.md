テーマの決まりごと (`index.ts`) とテスト (`index.test.ts`、vitest)。

- 色項目 6 つ (`ColorItem`) と CSS 変数名 (`COLOR_ITEM_CSS_VARIABLES`)、面のぼかしの変数 `--ytmd-surface-blur` (最大 40px)。
- 同梱テーマ (`BundledTheme`) の色 `BUNDLED_THEMES` と面のぼかし `BUNDLED_THEME_SURFACE_BLUR`。
- `resolveTheme(source)`: 同梱テーマならその値。テーマファイルなら中の CSS カスタムプロパティを読み、読めない・無い色項目は既定のテーマの色にし、読めない項目を `unreadableItems` に並べる。ファイルが無ければ既定の色で `fileMissing: true`。
- `isReadableColor` (hex・色関数・色名。`;` `{` `}` を含む値は読まない)、`toNativeColor` (oklab / oklch を hex に変換するなど、ネイティブ側に渡せる色にする)、`toCssVariables(colors, selector)`。
- import 元: `src/main/services/thememanager`・`backgroundvideo`、設定のアプリ画面、`store/schema.ts`。
