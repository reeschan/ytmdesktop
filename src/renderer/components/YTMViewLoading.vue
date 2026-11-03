<script setup lang="ts">
import { computed, ref } from "vue";
import logo from "~assets/icons/ytmd.png";
import { YTMViewStatus } from "~shared/types";

const unresponsive = ref(false);
const hide = ref(false);
const ytmViewLoadingStatus = ref<YTMViewStatus>(YTMViewStatus.Loading);
const ytmViewLoadingStatusMessage = computed(() => {
  switch (ytmViewLoadingStatus.value) {
    case YTMViewStatus.Loading:
      return "Loading YouTube Music...";
    case YTMViewStatus.Hooking:
      return "Waiting for YTMDesktop hooks...";
    case YTMViewStatus.Ready:
      return "Ready";
    default:
      return "";
  }
});
const ytmViewLoadTimedOut = ref(false);
const ytmViewLoadError = ref<{ code: number; description: string } | null>(null);

let ytmViewTimeout = setTimeout(() => {
  ytmViewLoadTimedOut.value = true;
}, 5 * 1000);

window.ytmd.ytmViewStatusChanged((status: YTMViewStatus) => {
  if (status !== YTMViewStatus.LoadFailed) ytmViewLoadError.value = null;
  if (status !== YTMViewStatus.Ready) {
    ytmViewLoadTimedOut.value = false;
    clearTimeout(ytmViewTimeout);
    ytmViewTimeout = setTimeout(() => {
      ytmViewLoadTimedOut.value = true;
    }, 5 * 1000);
  }

  ytmViewLoadingStatus.value = status;
});
window.ytmd.ytmViewLoadError(loadError => {
  ytmViewLoadError.value = loadError;
});
window.ytmd.memoryStore.onStateChanged(newState => {
  unresponsive.value = newState.ytmViewUnresponsive ?? false;
});

window.ytmd.appViewHiding(() => {
  hide.value = true;
});
window.ytmd.appViewShowing(() => {
  hide.value = false;
});

function onHide() {
  window.ytmd.appViewHide();
}

function refreshYtm() {
  window.ytmd.ytmViewReload();
}
</script>

<template>
  <Transition
    name="fade"
    @after-leave="onHide"
  >
    <div
      v-if="!hide"
      class="ytmview-loading-container"
    >
      <Transition
        name="fade"
        @after-leave="onHide"
      >
        <div
          v-if="ytmViewLoadingStatus != YTMViewStatus.Ready"
          class="ytmview-loading tw:bg-ytmd-background"
        >
          <img
            class="logo"
            :src="logo"
          >
          <div class="music-loader">
            <div class="loader-line tw:bg-ytmd-text" />
            <div class="loader-line tw:bg-ytmd-text" />
            <div class="loader-line tw:bg-ytmd-text" />
            <div class="loader-line tw:bg-ytmd-text" />
            <div class="loader-line tw:bg-ytmd-text" />
            <div class="loader-line tw:bg-ytmd-text" />
            <div class="loader-line tw:bg-ytmd-text" />
            <div class="loader-line tw:bg-ytmd-text" />
          </div>
          <p
            v-if="!ytmViewLoadError"
            class="ytmview-loading-status tw:text-ytmd-text-muted"
          >
            {{ ytmViewLoadingStatusMessage }}
          </p>
          <div
            v-else
            class="load-error-container"
          >
            <p class="ytmview-loading-status error">
              Failed to load YouTube Music: {{ ytmViewLoadError.description }} ({{ ytmViewLoadError.code }})
            </p>
            <button
              class="refresh-ytm-button tw:bg-ytmd-surface"
              @click="refreshYtm"
            >
              Refresh YouTube Music
            </button>
          </div>
          <div
            v-if="ytmViewLoadTimedOut && !ytmViewLoadError"
            class="ytmview-loading-timeout"
          >
            <span>YouTube Music is taking longer than usual to load</span>
          </div>
        </div>
      </Transition>
      <Transition
        name="fade"
        @after-leave="onHide"
      >
        <div
          v-if="unresponsive"
          class="ytmview-unresponsive tw:bg-ytmd-text/25"
        />
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.ytmview-loading-container {
  width: 100%;
  height: 100%;
}

.ytmview-loading {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  user-select: none;
}

.ytmview-unresponsive {
  display: flex;
  width: 100%;
  height: 100%;
  cursor: wait;
}

.load-error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Error colors stay the same in every theme */
.ytmview-loading-status.error {
  color: #f44336;
}

.refresh-ytm-button {
  border-radius: 4px;
  padding: 8px;
  display: flex;
  align-items: center;
  cursor: pointer;
  border: none;
}

.ytmview-loading-timeout {
  color: #f44336;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.logo {
  width: 160px;
  height: 160px;
}

.music-loader {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 160px;
}

.loader-line {
  width: 12px;
  height: 4px;
  border-radius: 10px;
  animation: musicloader 1.5s ease-in-out infinite;
}

.loader-line:nth-child(1) {
  animation-delay: 1s;
}

.loader-line:nth-child(2) {
  animation-delay: 0.8s;
}

.loader-line:nth-child(3) {
  animation-delay: 0.4s;
}

.loader-line:nth-child(4) {
  animation-delay: 0.2s;
}

.loader-line:nth-child(5) {
  animation-delay: 0.2s;
}

.loader-line:nth-child(6) {
  animation-delay: 0.4s;
}

.loader-line:nth-child(7) {
  animation-delay: 0.8s;
}

.loader-line:nth-child(8) {
  animation-delay: 1s;
}

@keyframes musicloader {
  0% {
    height: 4px;
  }
  50% {
    height: 72px;
  }
  100% {
    height: 4px;
  }
}
</style>
