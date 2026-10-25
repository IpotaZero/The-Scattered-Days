import { playerData } from "../Data/PlayerData"
import type { MapGraph } from "./MapGraph"
import { Language } from "../Data/Language"

// 地図画面の左上に出す、残機・次の回復までの時間・花粉・達成度の表示
export class MapHud {
    private readonly livesEl: HTMLElement
    private readonly livesRecoveryEl: HTMLElement
    private readonly scoreEl: HTMLElement

    constructor(el: HTMLElement, graph: MapGraph) {
        this.livesEl = el.querySelector<HTMLElement>(".map-lives-count")!
        this.livesRecoveryEl = el.querySelector<HTMLElement>(".map-lives-recovery")!
        this.scoreEl = el.querySelector<HTMLElement>(".map-score")!
        this.updateLives()
        this.updateScore()

        // 達成度はステージをクリアしたときにしか変わらず、クリア後は地図画面ごと作り直されるので、ここで一度だけ書く。
        // 終点をクリアするまでは空のまま。切り捨てて表示するので、全ステージをノーミスでクリアするまで100%にはならない
        if (playerData.isStageCleared(graph.goal.id)) {
            el.querySelector<HTMLElement>(".map-achievement")!.textContent =
                `${Language.text("achievement")} ${Math.floor(graph.achievement(playerData) * 100)}%`
        }
    }

    // 花粉はステージで稼ぐか技の習得で払ったときにだけ変わるので、毎フレームではなくその都度表示し直す
    updateScore(): void {
        this.scoreEl.textContent = `${Language.text("pollen")} ${playerData.getTotalScore().toLocaleString()}`
    }

    // 毎フレーム呼ばれる。文字が変わっていないときは書き換えず、画面を再描画させない
    updateLives(): void {
        MapHud.setText(this.livesEl, `${Language.text("lives")} ${playerData.getLives()} / ${playerData.getMaxLives()}`)

        const remainingMs = playerData.getLifeRecoveryRemainingMs()
        MapHud.setText(this.livesRecoveryEl, remainingMs > 0 ? `${Language.text("nextLife")} ${MapHud.formatMmSs(remainingMs)}` : "")
    }

    private static setText(el: HTMLElement, text: string) {
        if (el.textContent !== text) el.textContent = text
    }

    private static formatMmSs(ms: number): string {
        const totalSeconds = Math.ceil(ms / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        return `${minutes}:${String(seconds).padStart(2, "0")}`
    }
}
