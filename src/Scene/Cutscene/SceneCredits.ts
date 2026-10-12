import { Awaits } from "@ipota/functions"
import { App } from "../../App"
import { CREDITS } from "../../Data/Credits"
import { Scene } from "../../utils/Scene/Scene"
import { SceneCutscene } from "./SceneCutscene"

/**
 * クレジット。紙の色の画面を、題名とCREDITSの役目・名前が下から上へ流れていく。
 * 流れきると幕が下りる。
 */
export class SceneCredits extends SceneCutscene {
    private readonly roll = document.createElement("div")

    // 終わるか飛ばされると、nextが返す場面へ移る
    constructor(next: () => Promise<Scene>) {
        super("credits", next)
        this.root.classList.add("paper-scene")

        this.roll.className = "credits-roll"
        this.roll.innerHTML = `
            <div class="credits-title">The Scattered Days!</div>
            ${CREDITS.map(
                ({ role, names }) => `
                <div class="credits-section">
                    <div class="credits-role">${role}</div>
                    ${names.map((name) => `<div class="credits-name">${name}</div>`).join("")}
                </div>
            `,
            ).join("")}
        `
        this.root.append(this.roll)

        this.startBgm()
    }

    private async startBgm() {
        await Promise.all([App.bm.load({ src: "assets/bgm/title.mp3", trackVolume: 0.5 }), Awaits.sleep(2000)])
        await App.bm.play()
    }

    protected *script(): Generator<void, void, void> {
        yield* this.fade("var(--paper)", 1, 0, 60)

        // 画面の下の外から上の外まで、10秒で画面の高さ1つ分進む速さで流す
        const height = this.root.clientHeight
        for (let y = height; y > -this.roll.offsetHeight; y -= height / 600) {
            this.roll.style.transform = `translateY(${y}px)`
            yield
        }

        yield* this.fade("var(--paper)", 0, 1, 60)
    }
}
