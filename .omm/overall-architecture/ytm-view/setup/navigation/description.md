`setup/navigation.ts`。`createNavigationMenuArrows()` が、戻る (`west`) と進む (`east`) の Material Symbols のアイコンを作り、`history.back()` / `history.forward()` を呼ばせる。押せるかどうかは Navigation API (`navigation.canGoBack` / `canGoForward`、`currententrychange`) で切り替える。

置き場所は YTM の作りで変わる。`ytmusic-pivot-bar-renderer` があればその先頭に、無ければ (新しい YTM の UI) ナビバーの検索欄 (`ytmusic-search-box`) の前に置く。新しい UI では、開いた検索欄が矢印の上に重ならないように、閉じていたときの位置へ `margin-left` でずらす。
