<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { BackgroundVideoMotion, BackgroundVideoPlayback } from "~shared/background-video";
import type { BackgroundVideoState } from "./preload";

// How many blur radii the video extends past each edge of the window
const BLUR_EDGE_BLEED_RATIO = 3;
const VISIBLE_PLAYBACKS: BackgroundVideoPlayback[] = [BackgroundVideoPlayback.Playing, BackgroundVideoPlayback.Paused];
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const video = useTemplateRef<HTMLVideoElement>("video");

// Read here too, since the state only carries what other views reported (for example nothing before their first report)
const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
const systemReducedMotion = ref(reducedMotionQuery.matches);
function onReducedMotionChange(event: MediaQueryListEvent) {
  systemReducedMotion.value = event.matches;
}

// Nothing is shown until the first state arrives
const state = ref<BackgroundVideoState>({
  playback: BackgroundVideoPlayback.NotShown,
  motion: BackgroundVideoMotion.Continuous,
  src: null,
  maskOpacity: 0,
  maskBlur: 0,
  maskColor: "transparent"
});

const visible = computed(() => state.value.src !== null && VISIBLE_PLAYBACKS.includes(state.value.playback));
const still = computed(() => state.value.motion === BackgroundVideoMotion.Still || systemReducedMotion.value);
// A still video stays paused on its current frame
const shouldPlay = computed(() => visible.value && state.value.playback === BackgroundVideoPlayback.Playing && !still.value);

const videoStyle = computed(() => {
  const blur = Math.max(state.value.maskBlur, 0);
  // Blur fades the edges into transparency, so the video is extended past the window by that much
  const bleed = blur * BLUR_EDGE_BLEED_RATIO;
  return {
    filter: blur > 0 ? `blur(${blur}px)` : "none",
    inset: `${-bleed}px`,
    width: `calc(100% + ${bleed * 2}px)`,
    height: `calc(100% + ${bleed * 2}px)`
  };
});
const maskStyle = computed(() => ({
  backgroundColor: state.value.maskColor,
  opacity: Math.min(Math.max(state.value.maskOpacity, 0), 100) / 100
}));

function applyPlayback() {
  const element = video.value;
  if (!element) return;

  if (shouldPlay.value) {
    element.play().catch(() => {
      // Playback can be interrupted by a newer load or pause; the next state change retries it
    });
  } else {
    element.pause();
  }
}

function loadSource(src: string | null) {
  const element = video.value;
  if (!element) return;

  element.pause();
  if (src) {
    element.src = src;
  } else {
    element.removeAttribute("src");
  }
  element.load();
  applyPlayback();
}

watch(
  () => state.value.src,
  src => loadSource(src),
  { flush: "post" }
);
watch(shouldPlay, () => applyPlayback(), { flush: "post" });

onMounted(() => {
  reducedMotionQuery.addEventListener("change", onReducedMotionChange);
  window.ytmd.onBackgroundVideoState?.((newState: BackgroundVideoState) => {
    state.value = newState;
  });
  window.ytmd.requestBackgroundVideoState?.();
});

onBeforeUnmount(() => {
  reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
  video.value?.pause();
});
</script>

<template>
  <div class="background-video" :class="{ visible }">
    <video ref="video" class="video" :style="videoStyle" muted loop playsinline disablepictureinpicture preload="auto"></video>
    <div class="mask" :style="maskStyle"></div>
  </div>
</template>

<style scoped>
.background-video {
  position: fixed;
  inset: 0;
  overflow: hidden;
  visibility: hidden;
  background: transparent;
}

.background-video.visible {
  visibility: visible;
}

.video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mask {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>
