複数のアプリ画面で使う Vue SFC (`src/renderer/components/`)。どれも `<style scoped>` と `tw:` 付きの Tailwind のクラスで色を当てる。`window.ytmd` を呼ぶのは TitleBar と YTMViewLoading だけで、残りの 3 つは props と emit (v-model) だけで親とやりとりする。

| コンポーネント | 使う画面 |
| --- | --- |
| TitleBar | titlebar / settings / changelog / authorize-companion |
| YTMViewLoading | main (ローディング画面) |
| YTMDSetting | settings |
| KeybindInput | settings (Shortcuts タブ) |
| RangeInput | miniplayer (音量) |
