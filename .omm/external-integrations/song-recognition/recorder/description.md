ローディング画面 (アプリ画面、`ytmd-app://main`) の中で動く録音の処理。`window` に録音の関数を置き、音の元 (PC の音・既定のマイク・選んだ入力デバイス) を `AudioWorklet` で 44.1kHz・5 秒ぶん集め、`encodePcmBase64` で base64 にして返す。YTM 画面の下に常にある画面なので、YTM 画面に権限を渡さずに録れる。
