// クレジットに上から順に並べる役目と、その役目の人の名前。
export const CREDITS: readonly { readonly role: string; readonly names: readonly string[] }[] = [
    {
        role: "Music",
        names: [
            "Frédéric Chopin",
            "Berceuse Op. 57",
            "Waltz Op. 64 No. 3",
            "Waltz Op. 69 No. 2",
            "Waltz Op. 64 No. 2",
            "Waltz Op. 69 No. 1 “Farewell”",
        ],
    },
    { role: "Recordings", names: ["Musopen", "Diana Hughes", "Veronica van der Knaap"] },
    { role: "Sound Effects", names: ["効果音ラボ"] },
    { role: "Font", names: ["日比谷32（明朝体）"] },
    { role: "Game Design", names: ["お躁式ラケッツ!"] },
]
