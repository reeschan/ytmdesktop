YTM のフック (`window.__YTMD_HOOK__`) の `ytmPlayerController.playerApi.getVolume()` で今の音量を読み、`setVolume` と、`ytmStateStore` への `SET_VOLUME` の dispatch で当て直す関数式。カーブの差し替え・戻しをすぐ音に反映させるために使う。
