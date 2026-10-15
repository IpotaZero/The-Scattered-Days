import { BgmManager } from "@ipota/bgm-manager"
import { Sound } from "./utils/Sound"
import { PageBgmManager } from "./utils/PageBgmManager"
import { Dom } from "./Dom"
import type { Scenery } from "./World/Scenery"
import { SceneChanger } from "./utils/Scene/SceneChanger"
import { Looper } from "@ipota/my-utils"
import { FrameLimiter } from "./utils/FrameLimiter"
import { FpsMeter } from "./utils/FpsMeter"
import { AnalogInput, DigitalInput } from "@ipota/input"
import { DEFAULT_KEY_CONFIG, InputAction, Settings } from "./Data/Settings"

Dom.init()

export namespace App {
    const context = new AudioContext()
    const master = context.createGain()
    master.connect(context.destination)

    // ページが隠れたらSEを止める。戻った後は、次にSEを鳴らすときかクリック・タッチ・キー入力のときに再開する
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) context.suspend()
    })
    for (const type of ["click", "touchend", "keydown"]) {
        document.addEventListener(type, () => {
            if (!document.hidden && context.state === "suspended") context.resume()
        })
    }

    export namespace se {
        const base = `assets/se`

        export const graze = set(`${base}/graze.wav`, 0.1)
        export const hit = set(`${base}/player_hit.mp3`)
        export const dash = set(`${base}/dash.mp3`)
        export const u = set(`${base}/u.mp3`)

        export const crush = set(`${base}/crush.mp3`)
        export const bossDefeatPre = set(`${base}/boss_defeat_pre.mp3`)
        export const bossDefeat = set(`${base}/boss_defeat.mp3`)
        export const charge = set(`${base}/se_charge.mp3`)

        export const charged = set(`${base}/charged.mp3`)
        export const bomb = set(`${base}/bomb.mp3`, 0.8)

        export const start = set(`${base}/mushi.mp3`)
        export const uhm = set(`${base}/uhm.mp3`)
        export const unlock = set(`${base}/ドアを開ける2.mp3`)
        export const gameover = set(`${base}/gameover.mp3`)

        export const ok = set(`${base}/menu/ok.mp3`)
        export const cancel = set(`${base}/menu/cancel.mp3`)
        export const cursor = set(`${base}/menu/cursor.mp3`)
        export const disabled = set(`${base}/menu/disable.mp3`)

        export const bulletSuzu = set(`${base}/bullet/鈴を鳴らす.mp3`)

        function set(path: string, volume?: number) {
            return new Sound(path, context, master, { volume })
        }

        // 全SEの音量(0~1)
        export function setVolume(volume: number) {
            master.gain.value = volume
        }

        export const menu = {
            playOk: () => ok.play(),
            playCancel: () => cancel.play(),
            playCursor: () => cursor.play(),
            playDisable: () => disabled.play(),
        }
    }

    export namespace SetList {
        const base = `assets/bgm`

        // 地図の上で鳴らす曲。titleは切り替わったときに右上へ出す曲名
        export type Track = BgmManager.LoadConfig & { title: string }

        export const title = { src: `${base}/title.mp3`, trackVolume: 0.8 }

        // 景色のid(Scenery.id)ごとの曲。載せていない景色では、いま流れている曲がそのまま流れ続ける。
        // 地図を縦に割って同じ枠に入る景色は同じ曲にしてあり、枠の中を行き来しても曲は切り替わらない
        export const sceneries: Readonly<Record<string, Track>> = {
            // 地図の左端
            hive: { title: "Chopin: Berceuse Op. 57", src: `${base}/chopin-berceuse-op57.opus`, trackVolume: 1 },
            frost: { title: "Chopin: Berceuse Op. 57", src: `${base}/chopin-berceuse-op57.opus`, trackVolume: 1 },
            // 疾風道場と網掛道場
            gale: { title: "Chopin: Waltz Op. 64 No. 3", src: `${base}/chopin-waltz-op64-3.opus`, trackVolume: 0.5 },
            web: { title: "Chopin: Waltz Op. 64 No. 3", src: `${base}/chopin-waltz-op64-3.opus`, trackVolume: 0.5 },
            // 霧隠・砂塵・陽炎・鉄壁の道場
            mist: { title: "Chopin: Waltz Op. 69 No. 2", src: `${base}/chopin-waltz-op69-2.opus`, trackVolume: 0.8 },
            sand: { title: "Chopin: Waltz Op. 69 No. 2", src: `${base}/chopin-waltz-op69-2.opus`, trackVolume: 0.8 },
            haze: { title: "Chopin: Waltz Op. 69 No. 2", src: `${base}/chopin-waltz-op69-2.opus`, trackVolume: 0.8 },
            iron: { title: "Chopin: Waltz Op. 69 No. 2", src: `${base}/chopin-waltz-op69-2.opus`, trackVolume: 0.8 },
            // 流星道場と月影道場
            meteor: { title: "Chopin: Waltz Op. 64 No. 2", src: `${base}/chopin-waltz-op64-2.opus`, trackVolume: 0.7 },
            moon: { title: "Chopin: Waltz Op. 64 No. 2", src: `${base}/chopin-waltz-op64-2.opus`, trackVolume: 0.7 },
            // 四天王とチャンピオン
            nest: {
                title: "Chopin: Waltz Op. 69 No. 1 “Farewell”",
                src: `${base}/chopin-waltz-op69-1.opus`,
                trackVolume: 0.6,
            },
        }

        export function ofScenery(scenery: Scenery): Track | undefined {
            return sceneries[scenery.id]
        }
    }

    export const bm = new PageBgmManager()

    export const sc = new SceneChanger(Dom.container)

    export const looper = new Looper(60)

    // 描画だけを間引く。fpsは設定(settings)で決まる
    export const drawLimiter = new FrameLimiter(60)

    // 実測fpsの表示。シーンをまたいで出し続けるので、#containerではなくbodyに置く
    export const fpsMeter = new FpsMeter()
    document.body.append(fpsMeter.element)

    export const input = new DigitalInput<InputAction>(DEFAULT_KEY_CONFIG)

    // 自機の移動用。スティックの倒し具合をそのまま速さに使う。キーコンフィグはinputと共有する
    export const analogInput = new AnalogInput<InputAction>(DEFAULT_KEY_CONFIG)

    // 保存されている音量・キーコンフィグ・描画fps・fps表示を読み込んで、bm/se/input/analogInput/drawLimiter/fpsMeterへ反映する
    export const settings = new Settings({ bgm: bm, se, input, analogInput, drawLimiter, fpsMeter })
}
