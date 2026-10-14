import { playerData } from "../Data/PlayerData"

// 地図画面の左上に出す、残機・次の回復までの時間・花粉の表示
export class MapHud {
    private readonly livesEl: HTMLElement
    private readonly livesRecoveryEl: HTMLElement
    private readonly scoreEl: HTMLElement

    constructor(el: HTMLElement) {
        this.livesEl = el.querySelector<HTMLElement>(".map-lives-count")!
        this.livesRecoveryEl = el.querySelector<HTMLElement>(".map-lives-recovery")!
        this.scoreEl = el.querySelector<HTMLElement>(".map-score")!
        this.updateLives()
        this.updateScore()
    }

    // 花粉はステージで稼ぐか技の習得で払ったときにだけ変わるので、毎フレームではなくその都度表示し直す
    updateScore(): void {
        this.scoreEl.textContent = `花粉 ${playerData.getTotalScore().toLocaleString()}`
    }

    updateLives(): void {
        this.livesEl.textContent = `残機 ${playerData.getLives()} / ${playerData.getMaxLives()}`

        const remainingMs = playerData.getLifeRecoveryRemainingMs()
        this.livesRecoveryEl.textContent = remainingMs > 0 ? `次の回復まで ${MapHud.formatMmSs(remainingMs)}` : ""
    }

    private static formatMmSs(ms: number): string {
        const totalSeconds = Math.ceil(ms / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        return `${minutes}:${String(seconds).padStart(2, "0")}`
    }
}
