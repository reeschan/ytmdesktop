import {
  EQUALIZER_BAND_FREQUENCIES,
  EQUALIZER_BAND_MAX_DB,
  EQUALIZER_BAND_MIN_DB,
  EQUALIZER_PREAMP_MAX_DB,
  EQUALIZER_PREAMP_MIN_DB,
  EQUALIZER_PROMPT_MAX,
  EQUALIZER_STEP_DB,
  EqualizerPresetKind,
  EqualizerPresetRejection
} from "~shared/equalizer";
import { BUNDLED_EQUALIZER_PRESETS, effectiveEqualizerPreamp } from "~shared/equalizer/presets";
import { EqualizerAiPhase, EqualizerSignalType, type EqualizerSignal, type EqualizerViewState } from "~shared/equalizer/messages";
import { GROOVING_LLM_TIMEOUT_MS, GROOVING_PROVIDER_LABELS } from "~shared/grooving";
import { GROOVING_TEXT } from "./grooving-text";
import { EQUALIZER_TEXT, equalizerLanguage } from "./equalizer-text";
import { getEqualizerAudio } from "./equalizer-audio";
import { drawEqualizerCurve, startEqualizerSpectrum } from "./equalizer-spectrum";

export function createEqualizerView(send: (signal: EqualizerSignal) => void) {
  const element = document.createElement("section");
  element.className = "ytmd-eq-panel";
  let prompt = "";
  let name = "";
  let pendingSave = false;
  let dragging = false;
  let current: EqualizerViewState | null = null;
  let stopSpectrum: (() => void) | null = null;
  function updateSpectrum() {
    stopSpectrum?.();
    stopSpectrum = null;
    const graph = element.querySelector<HTMLCanvasElement>("[data-equalizer-graph]");
    if (element.hidden || !graph || !current) return;
    getEqualizerAudio().connect();
    const state = current;
    const curve = document.createElement("canvas");
    let curveColor = "";
    stopSpectrum = startEqualizerSpectrum(graph, {
      reducedMotionIntervalMs: 250,
      drawCurve(context, color) {
        if (curve.width !== graph.width || curve.height !== graph.height || curveColor !== color) {
          curve.width = graph.width;
          curve.height = graph.height;
          curveColor = color;
          const curveContext = curve.getContext("2d");
          if (curveContext) drawEqualizerCurve(curveContext, state.enabled, state.values, color);
        }
        context.drawImage(curve, 0, 0);
      }
    });
  }
  new MutationObserver(updateSpectrum).observe(element, { attributes: true, attributeFilter: ["hidden"] });
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (text: string, action: () => void) => {
    const node = el("button", text);
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  };
  function render(state: EqualizerViewState) {
    current = state;
    if (dragging) {
      updateSpectrum();
      return;
    }
    const active = document.activeElement instanceof HTMLElement && element.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = active?.dataset.equalizerFocus;
    const selection =
      (active instanceof HTMLInputElement && active.type === "text") || active instanceof HTMLTextAreaElement
        ? ([active.selectionStart, active.selectionEnd] as const)
        : null;
    const language = equalizerLanguage();
    const text = EQUALIZER_TEXT[language];
    const grooving = GROOVING_TEXT[language];
    element.lang = language;
    const heading = el("div");
    heading.className = "ytmd-eq-row";
    const toggleLabel = el("label", text.enabled);
    const toggle = el("input");
    toggle.type = "checkbox";
    toggle.checked = state.enabled;
    toggle.addEventListener("change", () => send({ type: EqualizerSignalType.SetEnabled, enabled: toggle.checked }));
    toggleLabel.prepend(toggle);
    heading.append(el("h2", text.title), toggleLabel);

    const presets = el("div");
    presets.className = "ytmd-eq-section";
    const select = el("select");
    select.setAttribute("aria-label", text.preset);
    const refs = [
      ...BUNDLED_EQUALIZER_PRESETS.map(p => ({ ref: { kind: EqualizerPresetKind.Bundled, id: p.id } as const, label: p.name[language] })),
      ...state.presets.map(p => ({ ref: { kind: EqualizerPresetKind.Saved, name: p.name } as const, label: p.name }))
    ];
    const selected = refs.findIndex(item => JSON.stringify(item.ref) === JSON.stringify(state.selectedPreset));
    if (selected < 0) {
      const option = el("option", text.custom);
      option.value = "-1";
      select.append(option);
    }
    refs.forEach((item, index) => {
      const option = el("option", item.label);
      option.value = String(index);
      select.append(option);
    });
    select.value = String(selected);
    select.addEventListener("change", () => {
      const item = refs[Number(select.value)];
      if (item) send({ type: EqualizerSignalType.SelectPreset, preset: item.ref });
    });
    presets.append(select);
    if (state.modified) presets.append(el("span", `${refs[selected]?.label ?? text.custom}${text.modified}`));
    const nameInput = el("input");
    nameInput.type = "text";
    nameInput.dataset.equalizerFocus = "name";
    nameInput.placeholder = text.name;
    nameInput.setAttribute("aria-label", text.name);
    nameInput.maxLength = 200;
    nameInput.value = name;
    nameInput.addEventListener("input", () => {
      name = nameInput.value;
    });
    const save = () => {
      pendingSave = true;
      send({ type: EqualizerSignalType.SavePreset, name, overwrite: false });
    };
    presets.append(nameInput, button(text.save, save));
    if (state.selectedPreset?.kind === EqualizerPresetKind.Saved) {
      const selectedName = state.selectedPreset.name;
      presets.append(
        button(text.rename, () => {
          const to = window.prompt(text.name, selectedName);
          if (to !== null) {
            pendingSave = false;
            send({ type: EqualizerSignalType.RenamePreset, from: selectedName, to });
          }
        }),
        button(text.remove, () => {
          if (window.confirm(text.confirmDelete)) send({ type: EqualizerSignalType.DeletePreset, name: selectedName });
        })
      );
    }
    if (state.notice) {
      const notice = el("div");
      notice.setAttribute("role", "status");
      notice.append(el("span", text.rejection[state.notice.rejection]));
      if (state.notice.rejection === EqualizerPresetRejection.Duplicate && pendingSave) {
        const duplicateName = state.notice.name;
        notice.append(
          el("span", text.overwrite),
          button(text.yes, () => {
            pendingSave = false;
            send({ type: EqualizerSignalType.SavePreset, name: duplicateName, overwrite: true });
          }),
          button(text.no, () => {
            pendingSave = false;
            send({ type: EqualizerSignalType.DismissNotice });
          })
        );
      } else notice.append(button(grooving.close, () => send({ type: EqualizerSignalType.DismissNotice })));
      presets.append(notice);
    }
    const graph = el("canvas");
    graph.setAttribute("data-equalizer-graph", "");
    graph.setAttribute("aria-hidden", "true");
    const bands = el("div");
    bands.className = "ytmd-eq-bands";
    EQUALIZER_BAND_FREQUENCIES.forEach((frequency, index) => {
      const label = el("label");
      const value = el("span", `${state.values.bands[index]} dB`);
      const input = el("input");
      input.type = "range";
      input.dataset.equalizerFocus = `band-${index}`;
      input.min = String(EQUALIZER_BAND_MIN_DB);
      input.max = String(EQUALIZER_BAND_MAX_DB);
      input.step = String(EQUALIZER_STEP_DB);
      input.value = String(state.values.bands[index]);
      input.setAttribute("aria-label", `${frequency} Hz`);
      input.addEventListener("pointerdown", () => {
        dragging = true;
      });
      input.addEventListener("input", () => {
        value.textContent = `${input.value} dB`;
        send({ type: EqualizerSignalType.SetBand, index, db: Number(input.value) });
      });
      input.addEventListener("dblclick", () => send({ type: EqualizerSignalType.SetBand, index, db: 0 }));
      label.append(value, input, el("span", frequency >= 1000 ? `${frequency / 1000}k` : String(frequency)));
      bands.append(label);
    });
    const preamp = el("label", `${text.preamp}: ${effectiveEqualizerPreamp(state.values)} dB${state.values.preampManual ? "" : ` (${text.auto})`}`);
    const preampInput = el("input");
    preampInput.type = "range";
    preampInput.dataset.equalizerFocus = "preamp";
    preampInput.min = String(EQUALIZER_PREAMP_MIN_DB);
    preampInput.max = String(EQUALIZER_PREAMP_MAX_DB);
    preampInput.step = String(EQUALIZER_STEP_DB);
    preampInput.value = String(effectiveEqualizerPreamp(state.values));
    preampInput.addEventListener("pointerdown", () => {
      dragging = true;
    });
    preampInput.addEventListener("input", () => send({ type: EqualizerSignalType.SetPreamp, db: Number(preampInput.value) }));
    preamp.append(preampInput);
    const preampRow = el("div");
    preampRow.append(preamp);
    if (state.values.preampManual) preampRow.append(button(text.reset, () => send({ type: EqualizerSignalType.ResetPreamp })));

    const ai = el("div");
    ai.className = "ytmd-eq-section";
    ai.append(el("h3", text.ai));
    const promptInput = el("textarea");
    promptInput.dataset.equalizerFocus = "prompt";
    promptInput.maxLength = EQUALIZER_PROMPT_MAX;
    promptInput.placeholder = text.prompt;
    promptInput.setAttribute("aria-label", text.prompt);
    promptInput.value = prompt;
    const remaining = el("span", text.remaining(EQUALIZER_PROMPT_MAX - prompt.length));
    promptInput.addEventListener("input", () => {
      prompt = promptInput.value;
      remaining.textContent = text.remaining(EQUALIZER_PROMPT_MAX - prompt.length);
    });
    ai.append(promptInput, remaining);
    for (const example of text.examples)
      ai.append(
        button(example, () => {
          prompt = example;
          promptInput.value = example;
          remaining.textContent = text.remaining(EQUALIZER_PROMPT_MAX - prompt.length);
        })
      );
    if (state.ai.phase !== EqualizerAiPhase.Running) ai.append(button(text.adjust, () => send({ type: EqualizerSignalType.AiRequest, prompt })));
    switch (state.ai.phase) {
      case EqualizerAiPhase.Running:
        ai.append(button(text.cancel, () => send({ type: EqualizerSignalType.AiCancel })));
        break;
      case EqualizerAiPhase.Applied:
        ai.append(el("p", state.ai.explanation));
        if (state.ai.canUndo) ai.append(button(text.undo, () => send({ type: EqualizerSignalType.AiUndo })));
        ai.append(button(text.saveResult, () => nameInput.focus()));
        break;
      case EqualizerAiPhase.Failed:
        ai.append(
          el("p", grooving.failures(GROOVING_LLM_TIMEOUT_MS / 1000)[state.ai.reason].text),
          button(grooving.close, () => send({ type: EqualizerSignalType.AiDismiss }))
        );
        break;
      case EqualizerAiPhase.NoKey:
        ai.append(
          el("p", text.noKey),
          button(grooving.openSettings, () => send({ type: EqualizerSignalType.OpenSettings })),
          button(grooving.close, () => send({ type: EqualizerSignalType.AiDismiss }))
        );
        break;
      case EqualizerAiPhase.Consent:
        ai.append(
          el("p", text.consent(GROOVING_PROVIDER_LABELS[state.provider])),
          button(text.send, () => send({ type: EqualizerSignalType.AiConsent, send: true })),
          button(text.dontSend, () => send({ type: EqualizerSignalType.AiConsent, send: false }))
        );
        break;
      case EqualizerAiPhase.Limited:
        ai.append(
          el("p", text.limited),
          button(grooving.close, () => send({ type: EqualizerSignalType.AiDismiss }))
        );
        break;
    }
    element.replaceChildren(heading, presets, graph, bands, preampRow, ai);
    updateSpectrum();
    if (focusKey) {
      const next = element.querySelector<HTMLElement>(`[data-equalizer-focus="${focusKey}"]`);
      next?.focus();
      if (selection && (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement)) next.setSelectionRange(selection[0], selection[1]);
    }
  }
  window.addEventListener("pointerup", () => {
    if (dragging) {
      dragging = false;
      if (current) render(current);
    }
  });
  window.addEventListener("pointercancel", () => {
    if (dragging) {
      dragging = false;
      if (current) render(current);
    }
  });
  return { element, render };
}
