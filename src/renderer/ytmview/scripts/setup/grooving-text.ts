// The fixed text of the Grooving screen, in each display language (state.language).
// Mood and genre item names, song titles, artists and the LLM's mood description are shown as they come and are not here.
// Numbers and names go in through the function arguments, so this file depends on nothing but ~shared/grooving.

import {
  GroovingDirection,
  GroovingFailureReason,
  GroovingMoodSection,
  GroovingStep,
  type GroovingDisplayLanguage,
  type GroovingRounds
} from "~shared/grooving";

export type GroovingText = {
  // Header
  close: string;
  round: (round: number, rounds: number) => string;

  // Key missing
  keyMissingHint: string;
  keyMissingTitle: string;
  keyMissingText: (providers: string[]) => string;
  keyNotSecure: string;
  openSettings: string;

  // Consent
  consentHint: string;
  consentTitle: string;
  consentText: string;
  sendsHistory: string;
  sendsHistoryWhen: string;
  sendsMood: string;
  sendsCandidates: string;
  sendsAlways: string;
  // Around the provider's name (shown in bold)
  sentToBefore: string;
  sentToAfter: string;
  shareHistory: string;
  shareHistoryDetail: string;
  noHistory: string;
  noHistoryDetail: string;
  notNow: string;
  notNowDetail: string;
  consentAfter: string;

  // Setup
  setupHint: string;
  setupTitle: string;
  setupLead: (genreLimit: number) => string;
  moodsLoading: string;
  moodsFailed: string;
  moodSections: Record<GroovingMoodSection, string>;
  moreChips: (count: number) => string;
  genreLimit: (limit: number) => string;
  genreLimitTitle: (limit: number) => string;
  moodPlaceholder: string;
  moodTextLabel: string;
  direction: string;
  directions: Record<GroovingDirection, { label: string; detail: string }>;
  needsHistory: string;
  discoverOnly: string;
  changeInSettings: string;
  rounds: string;
  roundsNote: (rounds: GroovingRounds) => string;
  start: string;
  usesProvider: (provider: string, model: string) => string;

  // Working
  working: Record<GroovingStep, string>;
  filledFromMood: string;

  // Choose
  chooseTitle: string;
  chooseLead: (round: number, rounds: number, previewSeconds: number) => string;
  familiarTag: string;
  newTag: string;
  previewing: string;
  pickThis: string;
  stop: string;
  preview: string;
  or: string;
  neither: string;
  neitherHint: string;

  // Done
  doneHint: string;
  queueFailedHint: string;
  doneKicker: string;
  doneCounts: (familiar: number, fresh: number) => string;
  save: string;
  saving: string;
  saved: string;
  again: string;
  savedToast: (playlistName: string) => string;
  saveFailed: string;
  queueFailed: string;
  queueRetry: string;
  thisRun: string;
  usageTokens: (input: string, output: string) => string;
  costUnknown: string;
  // Around the cost (shown in bold). pricesAsOf is YYYY-MM
  costBefore: string;
  costBelowMin: string;
  costAfter: (pricesAsOf: string) => string;
  listFamiliar: string;
  listNew: string;

  // Failed
  failedTitle: string;
  failedStep: Record<GroovingStep, string>;
  failures: (llmTimeoutSeconds: number) => Record<GroovingFailureReason, { title: string; text: string }>;
  // The card for Unusable in the Collect step: the search words (not candidates) were unusable
  unusableCollect: { title: string; text: string };
  retryCollect: string;
  retryKeeps: string;
  retriedLead: (retryText: string) => string;
  retry: string;
  settings: string;
};

export const GROOVING_TEXT: Record<GroovingDisplayLanguage, GroovingText> = {
  en: {
    close: "Close",
    round: (round, rounds) => `Round ${round} of ${rounds}`,

    keyMissingHint: "Setup",
    keyMissingTitle: "Set up an AI provider",
    keyMissingText: providers =>
      `Grooving uses ${providers.slice(0, -1).join(", ")} or ${providers[providers.length - 1]} with your own API key. Choose a provider in Settings and enter its key. A run usually costs a fraction of a cent.`,
    keyNotSecure: "This system can't store the key securely.",
    openSettings: "Open settings",

    consentHint: "First run",
    consentTitle: "Before you start",
    consentText:
      "Grooving asks an AI to pick pairs and build your list. Here is exactly what leaves this app, and where it goes. Your API key stays in this app's main process; YouTube Music's page never sees it.",
    sendsHistory: "Song titles and artists from your history and likes",
    sendsHistoryWhen: "Only if you share",
    sendsMood: "The mood you picked or typed, and your choices",
    sendsCandidates: "Titles and artists of the candidate songs",
    sendsAlways: "Always",
    sentToBefore: "Sent to ",
    sentToAfter: ", with your API key. Nothing is sent to YouTube Music.",
    shareHistory: "Share history",
    shareHistoryDetail: "All directions",
    noHistory: "Use without history",
    noHistoryDetail: "Discover only",
    notNow: "Not now",
    notNowDetail: "Nothing is sent",
    consentAfter: "You can change this later in Settings → Integrations → Grooving.",

    setupHint: "Step 1 of 3 · Set the mood",
    setupTitle: "What's the mood?",
    setupLead: genreLimit =>
      `Pick one mood and up to ${genreLimit} genres from YouTube Music, or say it in your own words. Then choose how far from your usual picks to go.`,
    moodsLoading: "Loading moods and genres from YouTube Music…",
    moodsFailed: "Couldn't load the moods and genres from YouTube Music. You can still describe the mood in your own words.",
    moodSections: { [GroovingMoodSection.Moods]: "Moods & activities", [GroovingMoodSection.Genres]: "Genres" },
    moreChips: count => `+${count} more`,
    genreLimit: limit => `Up to ${limit}`,
    genreLimitTitle: limit => `Up to ${limit} genres`,
    moodPlaceholder: "…or describe it: rainy night, lo-fi, a little nostalgic",
    moodTextLabel: "Describe the mood in your own words",
    direction: "Direction",
    directions: {
      [GroovingDirection.Familiar]: { label: "Stay familiar", detail: "Artists you know" },
      [GroovingDirection.Discover]: { label: "Discover", detail: "Artists you don't" },
      [GroovingDirection.Mix]: { label: "Mix", detail: "Your choices set the ratio" }
    },
    needsHistory: "Needs history",
    discoverOnly: "You chose not to share your history, so only Discover is available. ",
    changeInSettings: "Change in Settings",
    rounds: "Rounds",
    roundsNote: rounds =>
      `${{ 3: "Under a minute.", 5: "About a minute.", 10: "About two minutes." }[rounds]} Each round shows two songs; pick the one that fits.`,
    start: "Start Grooving",
    usesProvider: (provider, model) => `Uses ${provider} (${model}) with your API key`,

    working: {
      [GroovingStep.Collect]: "Collecting songs…",
      [GroovingStep.Pair]: "Finding the next pair…",
      [GroovingStep.List]: "Building your list…"
    },
    filledFromMood: "Your history is short, so some songs come from the mood's playlists.",

    chooseTitle: "Which one fits right now?",
    chooseLead: (round, rounds, previewSeconds) =>
      `Round ${round} of ${rounds}. Pick the song closer to how you feel. Preview plays ${previewSeconds} seconds from a third of the way in, then goes back to what you were hearing.`,
    familiarTag: "Familiar",
    newTag: "New to you",
    previewing: "Previewing ",
    pickThis: "Pick this",
    stop: "Stop",
    preview: "Preview",
    or: "OR",
    neither: "Neither",
    neitherHint: "Counts as a round. It tells Grooving both directions were off.",

    doneHint: "Done · now playing",
    queueFailedHint: "Done · not in the queue",
    doneKicker: "Your mood, as Grooving heard it",
    doneCounts: (familiar, fresh) => `Familiar ${familiar} · New ${fresh}`,
    save: "Save as playlist",
    saving: "Saving…",
    saved: "Saved",
    again: "Again",
    savedToast: playlistName => `Saved as a private playlist “${playlistName}”.`,
    saveFailed: "Could not save the playlist. Try again.",
    queueFailed: "Couldn't put the list into the queue. The player may still have the earlier queue.",
    queueRetry: "Load into the queue again",
    thisRun: "This run",
    usageTokens: (input, output) => `${input} input + ${output} output tokens`,
    costUnknown: "Cost unknown for this model",
    costBefore: "About ",
    costBelowMin: "Less than $0.001",
    costAfter: pricesAsOf => ` (estimate from the price list, ${pricesAsOf})`,
    listFamiliar: "Familiar",
    listNew: "New",

    failedTitle: "That didn't work",
    failedStep: {
      [GroovingStep.Collect]: "Collecting failed",
      [GroovingStep.Pair]: "Pair failed",
      [GroovingStep.List]: "List failed"
    },
    failures: llmTimeoutSeconds => ({
      [GroovingFailureReason.InvalidKey]: {
        title: "The API key was rejected",
        text: "The provider said the key is not valid. Check the key in Settings, then retry."
      },
      [GroovingFailureReason.ModelNotFound]: {
        title: "Model not found",
        text: "The model name in Settings was not found. Fix it in Settings, then retry."
      },
      [GroovingFailureReason.RateLimited]: {
        title: "Rate limit reached",
        text: "The provider is asking to slow down. Wait a minute and retry."
      },
      [GroovingFailureReason.Rejected]: {
        title: "The provider refused the request",
        text: "The provider turned the request down (for example, no credit left). Check your account with the provider, then retry."
      },
      [GroovingFailureReason.Network]: {
        title: "Couldn't reach the provider",
        text: `The request failed or took longer than ${llmTimeoutSeconds} seconds. Check your connection and retry.`
      },
      [GroovingFailureReason.Unusable]: {
        title: "The answer didn't fit",
        text: "The AI's answers didn't fit the candidate songs twice in a row. Retry, or try another model in Settings."
      },
      [GroovingFailureReason.YtmUnreadable]: {
        title: "Couldn't load songs",
        text: "YouTube Music didn't answer as expected, so there are no candidates yet. This is not the AI's fault."
      },
      [GroovingFailureReason.NotEnough]: {
        title: "Not enough songs",
        text: "There weren't enough songs for this mood and direction. Retry, or close and try another mood."
      }
    }),
    unusableCollect: {
      title: "The answer didn't fit",
      text: "The AI's search words weren't usable twice in a row, so there are no candidates yet. Retry, or try another model in Settings."
    },
    retryCollect: "Retry collects the songs again.",
    retryKeeps: "Your choices so far are kept; retry picks up from the step that failed.",
    retriedLead: retryText => `Grooving already tried once more on its own. ${retryText}`,
    retry: "Retry",
    settings: "Settings"
  },
  ja: {
    close: "閉じる",
    round: (round, rounds) => `${round} / ${rounds} 組目`,

    keyMissingHint: "準備",
    keyMissingTitle: "AI のサービスを設定",
    keyMissingText: providers =>
      `Grooving は ${providers.join("・")} のどれかを、自分の API Key で使う。設定でサービスを選び、その API Key を入れる。1 回の費用はふつう 1 セントに満たない。`,
    keyNotSecure: "このシステムでは API Key を安全に保存できない。",
    openSettings: "設定を開く",

    consentHint: "はじめて",
    consentTitle: "始める前に",
    consentText:
      "Grooving は AI に組を選ばせ、Grooving のリストを作らせる。このアプリから外に出るものと、その送り先は次のとおり。API Key はこのアプリのメインプロセスの中にとどまり、YouTube Music のページからは見えない。",
    sendsHistory: "履歴と高評価の曲名・アーティスト",
    sendsHistoryWhen: "共有するときだけ",
    sendsMood: "選んだか書いた気分と、組での選択",
    sendsCandidates: "候補の曲の曲名・アーティスト",
    sendsAlways: "常に",
    sentToBefore: "送り先は ",
    sentToAfter: "。自分の API Key で送る。YouTube Music には何も送らない。",
    shareHistory: "履歴を共有する",
    shareHistoryDetail: "すべての方向",
    noHistory: "履歴なしで使う",
    noHistoryDetail: "「外す」だけ",
    notNow: "今はしない",
    notNowDetail: "何も送らない",
    consentAfter: "あとから Settings → Integrations → Grooving で変えられる。",

    setupHint: "ステップ 1 / 3 · 気分を決める",
    setupTitle: "今の気分は?",
    setupLead: genreLimit =>
      `YouTube Music のムードを 1 つとジャンルを ${genreLimit} つまで選ぶか、自分の言葉で書く。それから、いつもの曲からどれだけ離れるかを選ぶ。`,
    moodsLoading: "YouTube Music から気分とジャンルを読み込み中…",
    moodsFailed: "YouTube Music から気分とジャンルを読み込めなかった。気分は自分の言葉で書ける。",
    moodSections: { [GroovingMoodSection.Moods]: "ムードとアクティビティ", [GroovingMoodSection.Genres]: "ジャンル" },
    moreChips: count => `+${count} 件`,
    genreLimit: limit => `${limit} つまで`,
    genreLimitTitle: limit => `ジャンルは ${limit} つまで`,
    moodPlaceholder: "…または言葉で: 雨の夜、lo-fi、少し懐かしい",
    moodTextLabel: "気分を自分の言葉で書く",
    direction: "方向",
    directions: {
      [GroovingDirection.Familiar]: { label: "寄せる", detail: "知っているアーティスト" },
      [GroovingDirection.Discover]: { label: "外す", detail: "知らないアーティスト" },
      [GroovingDirection.Mix]: { label: "ミックス", detail: "選び方で割合が決まる" }
    },
    needsHistory: "履歴が必要",
    discoverOnly: "履歴を共有しない設定なので、選べるのは「外す」だけ。",
    changeInSettings: "設定で変える",
    rounds: "組の数",
    roundsNote: rounds => `${{ 3: "1 分かからない。", 5: "1 分ほど。", 10: "2 分ほど。" }[rounds]}組ごとに 2 曲が出るので、合う方を選ぶ。`,
    start: "Grooving を始める",
    usesProvider: (provider, model) => `${provider} (${model}) を自分の API Key で使う`,

    working: {
      [GroovingStep.Collect]: "曲を集め中…",
      [GroovingStep.Pair]: "次の組を探し中…",
      [GroovingStep.List]: "Grooving のリストを作成中…"
    },
    filledFromMood: "履歴が少ないので、一部の曲は気分のプレイリストから足した。",

    chooseTitle: "今の気分に合うのはどっち?",
    chooseLead: (round, rounds, previewSeconds) =>
      `${round} / ${rounds} 組目。今の気分に近い方を選ぶ。試聴は曲の 3 分の 1 の位置から ${previewSeconds} 秒流し、そのあと聴いていた曲に戻る。`,
    familiarTag: "聴き慣れた曲",
    newTag: "新しい曲",
    previewing: "試聴中 ",
    pickThis: "これを選ぶ",
    stop: "止める",
    preview: "試聴",
    or: "または",
    neither: "どちらも違う",
    neitherHint: "1 組に数える。どちらの方向も違ったと Grooving に伝わる。",

    doneHint: "完成 · 再生中",
    queueFailedHint: "完成 · キューに入っていない",
    doneKicker: "Grooving が受け取った気分",
    doneCounts: (familiar, fresh) => `聴き慣れた曲 ${familiar} · 新しい曲 ${fresh}`,
    save: "プレイリストとして保存",
    saving: "保存中…",
    saved: "保存した",
    again: "もう一度",
    savedToast: playlistName => `非公開のプレイリスト「${playlistName}」として保存した。`,
    saveFailed: "プレイリストを保存できなかった。もう一度試せる。",
    queueFailed: "Grooving のリストをキューに入れられなかった。プレイヤーは前のキューのままかもしれない。",
    queueRetry: "もう一度キューに入れる",
    thisRun: "今回",
    usageTokens: (input, output) => `入力 ${input} + 出力 ${output} トークン`,
    costUnknown: "このモデルの費用は不明",
    costBefore: "約 ",
    costBelowMin: "$0.001 未満",
    costAfter: pricesAsOf => ` (${pricesAsOf} の価格表からの見積もり)`,
    listFamiliar: "聴き慣れた曲",
    listNew: "新しい曲",

    failedTitle: "うまくいかなかった",
    failedStep: {
      [GroovingStep.Collect]: "曲集めで失敗",
      [GroovingStep.Pair]: "組の作成で失敗",
      [GroovingStep.List]: "Grooving のリストの作成で失敗"
    },
    failures: llmTimeoutSeconds => ({
      [GroovingFailureReason.InvalidKey]: {
        title: "API Key が拒否された",
        text: "AI のサービスが、API Key が正しくないと答えた。設定で API Key を確かめてから、やり直す。"
      },
      [GroovingFailureReason.ModelNotFound]: {
        title: "モデルが見つからない",
        text: "設定のモデル名が見つからなかった。設定で直してから、やり直す。"
      },
      [GroovingFailureReason.RateLimited]: {
        title: "利用の上限に達した",
        text: "AI のサービスが、間隔を空けるよう求めている。1 分ほど待ってから、やり直す。"
      },
      [GroovingFailureReason.Rejected]: {
        title: "AI のサービスが頼みを断った",
        text: "残高が無いなどの理由で、AI のサービスが頼みを断った。AI のサービスのアカウントを確かめてから、やり直す。"
      },
      [GroovingFailureReason.Network]: {
        title: "AI のサービスにつながらない",
        text: `要求が失敗したか、${llmTimeoutSeconds} 秒を超えた。接続を確かめてから、やり直す。`
      },
      [GroovingFailureReason.Unusable]: {
        title: "答えが合わなかった",
        text: "AI の答えが 2 回続けて候補の曲に合わなかった。やり直すか、設定でほかのモデルを試す。"
      },
      [GroovingFailureReason.YtmUnreadable]: {
        title: "曲を読み込めない",
        text: "YouTube Music から思ったとおりの答えが返らず、候補がまだ無い。AI のせいではない。"
      },
      [GroovingFailureReason.NotEnough]: {
        title: "曲が足りない",
        text: "この気分と方向に合う曲が足りなかった。やり直すか、閉じてほかの気分を試す。"
      }
    }),
    unusableCollect: {
      title: "答えが合わなかった",
      text: "AI の検索語が 2 回続けて使えなかったため、候補がまだ無い。やり直すか、設定でほかのモデルを試す。"
    },
    retryCollect: "やり直すと、曲を集め直す。",
    retryKeeps: "ここまでの選択は残る。やり直すと、失敗したところから続ける。",
    retriedLead: retryText => `Grooving は自分でもう 1 回試した。${retryText}`,
    retry: "やり直す",
    settings: "設定"
  }
};
