# YouTube Music Desktop App (reeschan fork)

[日本語](#日本語) | [English](#english)

![Midnight theme](.github/images/fork/theme-midnight.png)

---

## 日本語

このリポジトリは [ytmdesktop/ytmdesktop](https://github.com/ytmdesktop/ytmdesktop) の個人用の fork です。
アプリの機能・ダウンロード・開発環境の作り方・ビルドの手順は、本家の README を参照してください。

- 本家の README: <https://github.com/ytmdesktop/ytmdesktop#readme>
- 本家のリリース: <https://github.com/ytmdesktop/ytmdesktop/releases>

この fork では、次の 3 つの機能を足しています。

### 1. テーマ

設定の **Appearance → Theme** で、アプリ全体の配色を選べます。アプリの画面 (タイトルバー・設定・ミニプレイヤーなど) と YouTube Music の画面の両方に、同じ色が当たります。切り替えは再起動なしで、すぐ反映されます。

- 同梱のテーマ: **Default** (元の見た目)、**Midnight** (紺)、**Forest** (深緑)、**Glass** (すりガラス)
- **Glass** は、ナビバー・サイドバー・プレイヤーバー・メニューの後ろをぼかし、背景動画が面の後ろにうっすら透けます
- **Theme file** を選ぶと、自分で書いたテーマファイル (CSS) を使えます

| Midnight | Forest |
|---|---|
| ![Midnight](.github/images/fork/theme-midnight.png) | ![Forest](.github/images/fork/theme-forest.png) |

![Glass (再生中の動画の上のすりガラス)](.github/images/fork/theme-glass.png)

![テーマの設定](.github/images/fork/settings-theme.png)

テーマファイルには、6 つの色項目を CSS 変数で書きます。

```css
:root {
  --ytmd-color-background: #0b1020; /* 背景 */
  --ytmd-color-surface: #161d33;    /* 面 (カード・メニュー・プレイヤーバー) */
  --ytmd-color-text: #e6e9f2;       /* 文字 */
  --ytmd-color-text-muted: #9aa3bd; /* 控えめな文字 */
  --ytmd-color-accent: oklch(0.72 0.12 260); /* アクセント (スイッチ・スライダー・シークバー) */
  --ytmd-color-border: #263052;     /* 枠線 */
}
```

- 色は、16 進・`rgb()`・`hsl()`・`oklch()` などの関数・名前付きの色で書けます (Tailwind v4 の `oklch` の色もそのまま使えます)。
- 面のぼかしは `--ytmd-surface-blur: 20px;` のように書けます (0〜40px、書かなければ 0 でぼかさない)。
- 書いていない項目や読めない値には、Default の色を使います。どの項目が読めなかったかは、設定画面に出ます。
- ファイルを保存し直すと、すぐ反映されます。
- カスタム CSS は、テーマの後に当たります。テーマの一部を上書きできます。
- 危険・エラー・成功を表す色は、テーマに関わらず固定です。
- アプリの画面は Tailwind v4 (prefix `tw:`) で、`tw:bg-ytmd-surface` のようにテーマの色を使っています。

### 2. 背景動画

設定の **Appearance → Background video** で、メインウィンドウの背景全体に映像を流せます。**Source** で、何を流すかを選びます。

- **Playing video** (既定): YouTube Music で今再生している曲の映像 (MV など) を、背景に大きく描きます。映像の無い曲では、その曲のジャケットで埋めます。一時停止の間は最後の場面で止まります。サインインの画面などでは出しません。
- **Video file**: 手元の動画ファイル (mp4 / webm) を、無音でループ再生します。

![背景動画](.github/images/fork/background-video.png)

![背景動画の設定](.github/images/fork/settings-background-video.png)

- **Mask opacity** (0〜100%): 動画の上に重ねる層の濃さ。層の色はテーマの背景色です。
- **Blur** (0〜20px): 動画のぼかし。
- 最小化・トレイに隠す・全画面表示の間は、動画を止めます。Video file の動画は、曲の一時停止とは連動しません。
- OS の「アニメーションを減らす」がオンのときは、動かさずに 1 枚の絵だけを出します (Playing video では曲が変わったときと一時停止したときに描き直す)。
- 動画ファイルが見つからないときは、動画なしで表示し、設定画面で知らせます。パスは残るので、ファイルを戻せば再び流れます。

### 3. Discord の表示テンプレート

設定の **Integrations → Discord rich presence** で、Discord に出す内容を変えられます。

![Discord の表示テンプレート](.github/images/fork/settings-discord.png)

- **First line**・**Second line**・**Album art tooltip** の 3 つの欄に、`{title}`・`{artist}`・`{album}` を差し込めます。例えば First line を `{title} / {artist}` にすると、曲名とアーティストを 1 行で出せます。
- 空になった欄は出しません。1 行目だけは、空のとき曲名で埋めます。
- 「Play on YTMDesktop」ボタンを出すかどうかと、Discord のメンバー一覧に何を出すか (アプリ名・1 行目・2 行目) を選べます。
- 設定画面で、再生中の曲を使ったプレビューを見ながら書けます。

### 構成

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/architecture/architecture-dark.svg">
  <img src="docs/architecture/architecture-light.svg" alt="YTMDesktop のアーキテクチャ図。Electron の main プロセスの ThemeManager がアプリの画面と YouTube Music のビューにテーマの色を注入し、BackgroundVideoManager は、再生中の動画を YouTube Music のビューのページの奥に描かせ、ローカルの動画ファイルはその下の背景動画のビューで流す。再生中の曲は PlayerStateStore からインテグレーションを通って Discord と Last.fm に送られる。">
</picture>

図のソースは [docs/architecture/architecture.d2](docs/architecture/architecture.d2) です。構成を変えたら、arch-diagram スキルの `render.py` で描き直します。

### 開発 (この fork で変わったところ)

```sh
pnpm install
pnpm start   # 開発版を起動
pnpm test    # Vitest (テーマの読み込み・背景動画の状態の決定・Discord の表示の組み立て)
```

設計の文書は [docs/specs/theme-bgvideo-discord.md](docs/specs/theme-bgvideo-discord.md)、[docs/adr/](docs/adr/)、[GLOSSARY.md](GLOSSARY.md) にあります。

PR と `development` への push では、GitHub Actions がテスト・型チェック・lint を回します (`.github/workflows/build.yml`)。

### リリース

Windows x64 のインストーラー (exe) を、タグから GitHub Release に上げます (`.github/workflows/publish.yml`)。

1. `package.json` の `version` を上げて、`development` にマージする
2. 同じ版のタグを付けて push する (例えば `git tag v2.2.0` と `git push origin v2.2.0`)。タグと `package.json` の版が違うと、ワークフローは止まる
3. Actions が exe を作り、この fork の **下書き** の Release に付ける。中身を確かめて公開する

アプリの自動更新は、この fork の公開済みの Release を見ます (リポジトリ変数 `YTMD_UPDATE_FEED_OWNER` と `YTMD_UPDATE_FEED_REPOSITORY`)。

---

## English

This repository is a personal fork of [ytmdesktop/ytmdesktop](https://github.com/ytmdesktop/ytmdesktop).
For the app's features, downloads, development setup and build steps, see the upstream README.

- Upstream README: <https://github.com/ytmdesktop/ytmdesktop#readme>
- Upstream releases: <https://github.com/ytmdesktop/ytmdesktop/releases>

This fork adds the following three features.

### 1. Themes

Pick a color theme in **Appearance → Theme**. The same colors apply to the app screens (title bar, settings, miniplayer and so on) and to YouTube Music itself, right away and without a restart.

- Bundled themes: **Default** (the original look), **Midnight** (navy), **Forest** (dark green) and **Glass** (frosted)
- **Glass** blurs what is behind the nav bar, the side bar, the player bar and the menus, so the background video shows faintly through them
- **Theme file** lets you use your own theme file (CSS)

| Midnight | Forest |
|---|---|
| ![Midnight](.github/images/fork/theme-midnight.png) | ![Forest](.github/images/fork/theme-forest.png) |

![Glass (frosted surfaces over the playing video)](.github/images/fork/theme-glass.png)

![Theme settings](.github/images/fork/settings-theme.png)

A theme file declares the six color items as CSS variables.

```css
:root {
  --ytmd-color-background: #0b1020; /* background */
  --ytmd-color-surface: #161d33;    /* surface (cards, menus, player bar) */
  --ytmd-color-text: #e6e9f2;       /* text */
  --ytmd-color-text-muted: #9aa3bd; /* muted text */
  --ytmd-color-accent: oklch(0.72 0.12 260); /* accent (switches, sliders, seek bar) */
  --ytmd-color-border: #263052;     /* border */
}
```

- Colors can be hex, `rgb()`, `hsl()`, `oklch()` and the other color functions, or named colors (Tailwind v4 `oklch` colors work as they are).
- Write the surface blur as `--ytmd-surface-blur: 20px;` (0–40px; leave it out for 0, no blur).
- Missing or unreadable items fall back to the Default values, and the settings screen lists them.
- Saving the file again applies it right away.
- Custom CSS is applied after the theme, so it can override parts of it.
- Colors that mean something (danger, error, success) stay the same in every theme.
- The app screens use Tailwind v4 with the `tw:` prefix, for example `tw:bg-ytmd-surface`.

### 2. Background video

In **Appearance → Background video**, play a picture across the whole background of the main window. **Source** chooses what to play.

- **Playing video** (default): the video of the song YouTube Music is playing now (a music video and so on), drawn large behind the page. Songs without a video track fill it with their artwork. It holds the last frame while the song is paused, and it is not shown on pages such as the sign-in screen.
- **Video file**: a local video file (mp4 / webm), looped without sound.

![Background video](.github/images/fork/background-video.png)

![Background video settings](.github/images/fork/settings-background-video.png)

- **Mask opacity** (0–100%): how strongly the layer over the video covers it. The layer uses the theme's background color.
- **Blur** (0–20px): blur applied to the video.
- The video stops while the window is minimized, hidden to the tray or in fullscreen. A video file does not follow the song's pause.
- When the OS asks for reduced motion, a single still picture is shown instead (with Playing video, it is redrawn when the song changes or is paused).
- When the video file is missing, the window shows no video and the settings screen says so. The path is kept, so the video comes back once the file does.

### 3. Discord display templates

In **Integrations → Discord rich presence**, change what Discord shows.

![Discord display templates](.github/images/fork/settings-discord.png)

- **First line**, **Second line** and **Album art tooltip** take `{title}`, `{artist}` and `{album}`. For example, `{title} / {artist}` on the first line shows the title and the artist on one line.
- Empty lines are left out, except the first line, which falls back to the title.
- Choose whether to show the "Play on YTMDesktop" button, and what the Discord member list shows (app name, first line or second line).
- A preview built from the playing song shows the result while you type.

### Architecture

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/architecture/architecture-dark.svg">
  <img src="docs/architecture/architecture-light.svg" alt="YTMDesktop architecture. In the Electron main process, ThemeManager injects the theme colors into the app screens and the YouTube Music view, and BackgroundVideoManager has the YouTube Music view draw the playing video behind its page, or plays a local video file in the background video view placed below it. The playing song goes from PlayerStateStore through the integrations to Discord and Last.fm.">
</picture>

The diagram source is [docs/architecture/architecture.d2](docs/architecture/architecture.d2). Redraw it with the arch-diagram skill's `render.py` when the structure changes.

### Development (what changed in this fork)

```sh
pnpm install
pnpm start   # run the dev build
pnpm test    # Vitest (theme resolution, background video decision, Discord activity builder)
```

Design documents: [docs/specs/theme-bgvideo-discord.md](docs/specs/theme-bgvideo-discord.md), [docs/adr/](docs/adr/) and [GLOSSARY.md](GLOSSARY.md).

On pull requests and pushes to `development`, GitHub Actions runs the tests, the type check and lint (`.github/workflows/build.yml`).

### Releases

A tag builds the Windows x64 installer (exe) and attaches it to a GitHub Release (`.github/workflows/publish.yml`).

1. Bump `version` in `package.json` and merge it into `development`
2. Push a tag for the same version (for example `git tag v2.2.0` and `git push origin v2.2.0`). The workflow stops when the tag and `package.json` disagree
3. Actions builds the exe and attaches it to a **draft** Release of this fork. Check it and publish it

The app's auto updater follows the published Releases of this fork (repository variables `YTMD_UPDATE_FEED_OWNER` and `YTMD_UPDATE_FEED_REPOSITORY`).

---

License: [GPL-3.0](LICENSE), the same as upstream.
