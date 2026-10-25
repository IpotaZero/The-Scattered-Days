export type LanguageCode = "ja" | "en"

const names: Record<LanguageCode, string> = { ja: "日本語", en: "English" }

const translations: Record<string, Record<LanguageCode, string>> = {
    settings: { ja: "設定", en: "Settings" },
    language: { ja: "言語", en: "Language" },
    keyConfig: { ja: "キーコンフィグ", en: "Key Config" },
    deleteData: { ja: "データの削除", en: "Delete Data" },
    back: { ja: "戻る", en: "Back" },
    reset: { ja: "初期設定に戻す", en: "Reset to Defaults" },
    pressKey: { ja: "キーを押す...", en: "Press a key..." },
    add: { ja: "＋ 追加", en: "＋ Add" },
    deleteSave: { ja: "セーブデータを消す?", en: "Delete save data?" },
    yes: { ja: "はい", en: "Yes" },
    no: { ja: "いいえ", en: "No" },
    drag: { ja: "ドラッグ", en: "Drag" },
    drawFps: { ja: "描画fps", en: "Draw FPS" },
    showFps: { ja: "fps表示", en: "Show FPS" },
    liteBullets: { ja: "弾の軽量描画", en: "Lightweight Bullets" },
    up: { ja: "上", en: "Up" },
    down: { ja: "下", en: "Down" },
    left: { ja: "左", en: "Left" },
    right: { ja: "右", en: "Right" },
    slow: { ja: "低速", en: "Focus" },
    action: { ja: "技", en: "Action" },
    suicide: { ja: "自爆", en: "Self-Destruct" },
    ok: { ja: "決定", en: "Confirm" },
    cancel: { ja: "キャンセル", en: "Cancel" },
    map: { ja: "全体図", en: "Map" },
    changeType: { ja: "型の変更", en: "Change Loadout" },
    title: { ja: "タイトルへ戻る", en: "Return to Title" },
    lives: { ja: "残機", en: "Lives" },
    pollen: { ja: "花粉", en: "Pollen" },
    nextLife: { ja: "次の回復まで", en: "Next life in" },
    achievement: { ja: "達成度", en: "Completion" },
    needle: { ja: "針", en: "Shot" },
    technique: { ja: "技", en: "Ability" },
    none: { ja: "なし", en: "None" },
    chooseNeedle: { ja: "針を選択", en: "Choose Shot" },
    chooseTechnique: { ja: "技を選択", en: "Choose Ability" },
    learnEquip: { ja: "習得して装備する?", en: "Learn and equip?" },
    retry: { ja: "Retry", en: "Retry" },
    next: { ja: "Next", en: "Next" },
    previous: { ja: "Back", en: "Back" },
    confirm: { ja: "決定", en: "Confirm" },
    start: { ja: "Start", en: "Start" },
    titleSettings: { ja: "Settings", en: "Settings" },
    opening: { ja: "OP", en: "OP" },
    ending: { ja: "ED", en: "ED" },
    credits: { ja: "Credits", en: "Credits" },
    restoreLife: { ja: "回復する?", en: "Restore a life?" },
    restoreLifeDescription: { ja: "花粉を払って残機を1つ回復する。", en: "Spend pollen to restore one life." },
    noAbility: { ja: "技を使用しない。", en: "No ability equipped." },
    actionHintMobile: {
        ja: "ステージ中、2本の指で画面をタップすると技を使う。",
        en: "Tap with two fingers during a stage to use your ability.",
    },
    actionHintKeyboard: {
        ja: "ステージ中、{key}キーを押すと技を使う。",
        en: "Press {key} during a stage to use your ability.",
    },
    proceed: { ja: "前進", en: "Proceed" },
    runEnded: { ja: "停滞", en: "Run Ended" },
    minimapBack: { ja: "戻る: cancel({key})", en: "Back: cancel({key})" },
    pressAnyKey: { ja: "Click or Press Any Key", en: "Click or Press Any Key" },
}

const equipmentText: Record<string, Record<LanguageCode, { label: string; description: string }>> = {
    standard: {
        ja: { label: "拡散", description: "前方に打ち込み。追尾弾を添えて。" },
        en: { label: "Spread", description: "Fire forward with homing shots." },
    },
    laser: {
        ja: { label: "貫通", description: "自機の左右から常時光線を出し続ける。" },
        en: { label: "Piercing", description: "Continuous beams fire from both sides of you." },
    },
    dash: {
        ja: { label: "高速移動", description: "一瞬だけ高速移動する。高速移動中は無敵になる。" },
        en: { label: "Dash", description: "Dash briefly and become invulnerable." },
    },
    needle: {
        ja: { label: "大針", description: "真上へ大きな針を飛ばす。最初に触れた敵ひとつに大きな傷を与える。" },
        en: {
            label: "Great Needle",
            description: "Launch a large needle straight up to deal heavy damage to the first enemy hit.",
        },
    },
    sweep: {
        ja: { label: "一掃", description: "自機から波を広げ、画面の敵弾をすべて花粉に変える。" },
        en: { label: "Sweep", description: "Send out a wave that turns every enemy bullet on screen into pollen." },
    },
    extraLife: {
        ja: { label: "追加残機", description: "追加の残機が得られる。" },
        en: { label: "Extra Life", description: "Gain an extra life." },
    },
    barrier: {
        ja: { label: "障壁", description: "その場に結界を張る。中に入った敵弾を花粉に変える。" },
        en: { label: "Barrier", description: "Create a ward that turns enemy bullets inside it into pollen." },
    },
}

let current: LanguageCode = navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en"

export namespace Language {
    export function currentLanguage(): LanguageCode {
        return current
    }

    export function set(language: LanguageCode) {
        current = language
        document.documentElement.lang = language
    }

    export function toggle() {
        set(current === "ja" ? "en" : "ja")
    }

    export function name(): string {
        return names[current]
    }

    export function text(key: string, values?: Record<string, string>): string {
        return (translations[key]?.[current] ?? key).replace(
            /\{(\w+)\}/g,
            (_, name: string) => values?.[name] ?? `{${name}}`,
        )
    }

    export function equipment(id: string, field: "label" | "description", fallback: string): string {
        return equipmentText[id]?.[current]?.[field] ?? fallback
    }

    export function mapLabel(label: string): string {
        if (current === "ja") return label
        return label
            .replace("師匠の庵", "Mentor's Hermitage")
            .replace("道場主", "Master")
            .replace("師範代", "Senior")
            .replace("高弟", "Adept")
            .replace("門下生", "Student")
            .replace("道場", "Dojo")
            .replace("霜月", "Frost")
            .replace("疾風", "Gale")
            .replace("網掛", "Web")
            .replace("霧隠", "Mist")
            .replace("砂塵", "Sand")
            .replace("陽炎", "Haze")
            .replace("鉄壁", "Iron")
            .replace("流星", "Meteor")
            .replace("月影", "Moon")
            .replace("四天王", "Four Lords")
            .replace("チャンピオン", "Champion")
            .replace("大雀蜂", "Giant Hornet")
            .replace("蠍", "Scorpion")
            .replace("揺蚊", "Midge")
            .replace("百足", "Centipede")
            .replace("蚕", "Silkworm")
            .replace("・", " ")
    }
}
