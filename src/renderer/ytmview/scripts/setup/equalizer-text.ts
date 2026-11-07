import { GroovingLanguage, resolveGroovingLanguage } from "~shared/grooving";
import { EqualizerPresetRejection } from "~shared/equalizer";

export function equalizerPageLanguage() {
  let pageLanguage: string | null = null;
  try {
    const value = (window as unknown as { ytcfg?: { get?: (key: string) => unknown } }).ytcfg?.get?.("HL");
    if (typeof value === "string") pageLanguage = value;
  } catch {
    // Use the default language if the page configuration is unavailable.
  }
  return pageLanguage;
}

export function equalizerLanguage() {
  return resolveGroovingLanguage(GroovingLanguage.Auto, equalizerPageLanguage());
}

export const EQUALIZER_TEXT = {
  en: {
    title: "Equalizer",
    enabled: "On",
    preset: "Preset",
    custom: "Custom",
    modified: " · modified",
    save: "Save",
    name: "Preset name",
    rename: "Rename",
    confirmRename: "Change",
    remove: "Delete",
    confirmDelete: "Delete this preset?",
    overwrite: "Overwrite this preset?",
    yes: "Overwrite",
    no: "Cancel",
    preamp: "Preamp",
    auto: "Auto",
    reset: "Return to auto",
    ai: "Adjust with AI",
    prompt: "Describe the sound",
    remaining: (n: number) => `${n} characters left`,
    examples: ["More bass", "Clearer vocals", "Quiet at night"],
    adjust: "Adjust",
    cancel: "Cancel",
    undo: "Undo",
    saveResult: "Save as preset",
    noKey: "Enter an AI provider API key in Settings.",
    consent: (provider: string) => `Send the song title and your words to ${provider}.`,
    send: "Send",
    dontSend: "Don't send",
    limited: "Too many requests. Try again later.",
    rejection: {
      [EqualizerPresetRejection.EmptyName]: "Enter a name.",
      [EqualizerPresetRejection.NameTooLong]: "The name is too long.",
      [EqualizerPresetRejection.BundledName]: "That name belongs to a bundled preset.",
      [EqualizerPresetRejection.Duplicate]: "A preset with that name already exists.",
      [EqualizerPresetRejection.Full]: "The preset limit has been reached.",
      [EqualizerPresetRejection.NotFound]: "That preset could not be found."
    }
  },
  ja: {
    title: "イコライザ",
    enabled: "オン",
    preset: "プリセット",
    custom: "カスタム",
    modified: "・変更あり",
    save: "保存",
    name: "プリセット名",
    rename: "名前を変える",
    confirmRename: "変える",
    remove: "消す",
    confirmDelete: "このプリセットを消しますか？",
    overwrite: "上書きしますか？",
    yes: "上書き",
    no: "キャンセル",
    preamp: "プリアンプ",
    auto: "自動",
    reset: "自動に戻す",
    ai: "AI での調整",
    prompt: "聞こえ方を言葉で書く",
    remaining: (n: number) => `残り ${n} 文字`,
    examples: ["低音をもっと", "ボーカルをはっきり", "夜に小さい音で"],
    adjust: "調整する",
    cancel: "やめる",
    undo: "元に戻す",
    saveResult: "プリセットとして保存",
    noKey: "設定で AI のサービスの API Key を入れてください。",
    consent: (provider: string) => `曲名と書いた言葉を ${provider} に送ります。`,
    send: "送る",
    dontSend: "送らない",
    limited: "上限に達しました。時間をおいてもう一度お試しください。",
    rejection: {
      [EqualizerPresetRejection.EmptyName]: "名前を入力してください。",
      [EqualizerPresetRejection.NameTooLong]: "名前が長すぎます。",
      [EqualizerPresetRejection.BundledName]: "同梱プリセットと同じ名前は使えません。",
      [EqualizerPresetRejection.Duplicate]: "同じ名前のプリセットがあります。",
      [EqualizerPresetRejection.Full]: "保存できる数の上限に達しました。",
      [EqualizerPresetRejection.NotFound]: "プリセットが見つかりません。"
    }
  }
} as const;
