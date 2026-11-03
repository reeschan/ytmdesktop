設定 (`ConfigStore`、`conf` で保存) の型 `StoreSchema` と、保存しない実行中の値 (`MemoryStore`) の型 `MemoryStoreSchema`。テストは無い。

- `StoreSchema`: `metadata`・`general`・`appearance` (カスタム CSS・拡大率・トレイアイコン・テーマ `ThemeSelection` とテーマファイル・背景動画とマスク)・`playback`・`integrations` (Companion Server・Discord と表示テンプレート・Last.fm・OS のメディア操作・Shazam のキーと音の元)・`shortcuts`・`state` (ウィンドウの位置など)・`lastfm`・`developer`。
- `MemoryStoreSchema`: Discord の接続失敗・テーマの読めない項目・ファイルが無い印・ショートカット登録の失敗・Companion の認可の受付・`safeStorageAvailable`・自動更新の状態・YTM 画面の読み込み状態・Last.fm の認証の段階・曲の聞き取りの入力デバイス一覧など。
- `TrayIconStyle` (Auto・White・Black) と `ThemeSelection` (同梱テーマ + `file`) もここで定義する。
- 既定値と移行は `src/main/services/configstore/index.ts` にある。
- 一番多く import される共有ファイル: Service のほとんど (configstore・statemanager・thememanager・ytmviewmanager など)、`Integration` 基底クラスと多くの Integration、各アプリ画面の preload と設定画面、YTM 画面の preload。
