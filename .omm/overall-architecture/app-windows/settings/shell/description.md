`Index.vue`。共通の `TitleBar` (タイトル "Settings"、アイコン settings) を上に置き、その下に `Settings.vue` を `<Suspense>` で出す (Settings.vue はトップレベルで `await` して設定を読むため)。高さは `calc(100% - 36px)`。
