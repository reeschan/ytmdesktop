どこでも使う小さな型と列挙。テストは無い。

- `WindowsEventArguments` (最小化・最大化・全画面・最前面)。
- `YTMViewStatus` (Loading・Hooking・Ready・LoadFailed) と、YTM 画面のフックの進み具合のビットフラグ `YTMViewSetupCompletionFlags` (LocationNotApplicable・Early・Styles・Navigation・Hooks・Remote・Extras)、`AllYTMViewSetupCompletionFlags`・`YTMViewSetupCompletionFlagsNames` (Hook Error のダイアログで使う)。
- `Paths<T>` / `ValueAtPath<T, P>`: 設定のパス (`"integrations.shazamEnabled"` など) の型。配列でパスは終わる。
- `Constructor<T>` / `DependencyConstructor<T>`: Service の依存を表す型。
- `ProtectedAPIOpCode` (ProvideAPIPort・Message・Invoke・InvokeResponse): MessagePort の Protected API の opcode。
- import 元: ServiceHost とほぼすべての Service、`Integration` 基底クラス、アプリ画面の preload、YTM 画面のスクリプト (`scripts/index.ts`・`protectedapimanager.ts`)、`YTMViewLoading.vue`。
