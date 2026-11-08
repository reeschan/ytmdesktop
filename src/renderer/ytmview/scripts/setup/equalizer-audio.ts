import { EQUALIZER_BAND_FREQUENCIES, type EqualizerValues } from "~shared/equalizer";
import { equalizerFilterPlan } from "~shared/equalizer/filters";

const TRANSITION_SECONDS = 0.03;
const VIDEO_LOOKUP_DELAY_MS = 250;

function createEqualizerAudio() {
  let enabled = false;
  let values: EqualizerValues = { bands: EQUALIZER_BAND_FREQUENCIES.map(() => 0), preamp: 0, preampManual: false };
  let context: AudioContext | null = null;
  let preamp: GainNode | null = null;
  let filters: BiquadFilterNode[] = [];
  let analyser: AnalyserNode | null = null;
  let hasConnectedVideo = false;
  let observer: MutationObserver | null = null;
  let lookupTimer: ReturnType<typeof setTimeout> | null = null;
  const sources = new WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>();

  function update() {
    if (!context || !preamp) return;
    const plan = equalizerFilterPlan(enabled, values);
    preamp.gain.setTargetAtTime(plan.preampGain, context.currentTime, TRANSITION_SECONDS);
    filters.forEach((filter, index) => filter.gain.setTargetAtTime(plan.filters[index].gainDb, context!.currentTime, TRANSITION_SECONDS));
  }

  function resume() {
    if (context?.state === "suspended") void context.resume().catch(error => console.error("Equalizer audio resume failed", error));
  }

  function attachVideo() {
    if (!context || !preamp) return;
    const video = document.querySelector("video");
    if (!video || sources.has(video)) return;
    try {
      const source = context.createMediaElementSource(video);
      sources.set(video, source);
      try {
        source.connect(preamp);
      } catch (error) {
        source.connect(context.destination);
        throw error;
      }
      hasConnectedVideo = true;
      video.addEventListener("play", resume);
      if (!video.paused) resume();
    } catch (error) {
      console.error("Equalizer audio video connection failed", error);
    }
  }

  function connect() {
    try {
      if (!context) {
        const nextContext = new AudioContext();
        const nextPreamp = nextContext.createGain();
        const plan = equalizerFilterPlan(enabled, values);
        const nextFilters = plan.filters.map(item => {
          const filter = nextContext.createBiquadFilter();
          filter.type = item.type;
          filter.frequency.value = item.frequency;
          filter.Q.value = item.q;
          filter.gain.value = item.gainDb;
          return filter;
        });
        const nextAnalyser = nextContext.createAnalyser();
        nextAnalyser.fftSize = 2048;
        nextAnalyser.smoothingTimeConstant = 0.8;
        nextPreamp.gain.value = plan.preampGain;
        let tail: AudioNode = nextPreamp;
        for (const filter of nextFilters) {
          tail.connect(filter);
          tail = filter;
        }
        tail.connect(nextAnalyser);
        nextAnalyser.connect(nextContext.destination);
        context = nextContext;
        preamp = nextPreamp;
        filters = nextFilters;
        analyser = nextAnalyser;
      }
      if (!observer) {
        observer = new MutationObserver(() => {
          if (lookupTimer !== null) return;
          lookupTimer = setTimeout(() => {
            lookupTimer = null;
            attachVideo();
          }, VIDEO_LOOKUP_DELAY_MS);
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }
      attachVideo();
    } catch (error) {
      console.error("Equalizer audio connection failed", error);
    }
  }

  return {
    apply(nextEnabled: boolean, nextValues: EqualizerValues) {
      enabled = nextEnabled;
      values = { ...nextValues, bands: [...nextValues.bands] };
      try {
        if (enabled) connect();
        update();
      } catch (error) {
        console.error("Equalizer audio update failed", error);
      }
    },
    connect,
    getAnalyser() {
      return context && analyser && hasConnectedVideo ? { analyser, sampleRate: context.sampleRate } : null;
    }
  };
}

const equalizerAudio = createEqualizerAudio();
export function getEqualizerAudio() {
  return equalizerAudio;
}
