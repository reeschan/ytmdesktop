ログイン時の起動。`ConfigStore` が設定の変更のたびに `reconcileConfig` で `app.setLoginItemSettings({ openAtLogin: general.startOnBoot })` を呼ぶ。コードのコメントにあるとおり、本来は ConfigStore の仕事ではない置き場所。
