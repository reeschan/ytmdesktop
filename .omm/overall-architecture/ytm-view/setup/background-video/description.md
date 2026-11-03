`setup/background-video.ts`。背景動画の元が「再生中の動画」のときの描き手 (ADR 0002)。`initBackgroundVideo()` が `<html>` の直下に、一番奥の z-index の `canvas` (`ytmd-background-video-canvas`) とそのすぐ上のマスク (`ytmd-background-video-mask`) を `position: fixed` で置く (どちらも `pointer-events: none`)。

- プレイヤーの `<video>` を探し (無ければ MutationObserver で待つ)、`requestVideoFrameCallback` で届いたフレームを、object-fit: cover のように canvas に描き写す。映像のトラックが無い曲では、一番大きいサムネイル (ジャケット画像) を描く。
- preload から `ytmd-background-video-state` の `YtmBackgroundState` (show / playback / motion / maskOpacity / maskBlur / maskColor) を受けて表示・ぼかし・マスクを変える。受けるのは `event.source === window` で形の正しいものだけ。Still なら毎フレームは描かず、読み込みと一時停止のときだけ描く。
- 描ける絵があるか (`available`) と `prefers-reduced-motion` を `ytmd-background-video-report` で preload に報告する。絵が消えたことは 2 秒待ってから報告し、次の曲の読み込みで背景がちらつかないようにする。
