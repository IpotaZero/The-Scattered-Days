import { Ease } from "@ipota/functions"

// 一幕の中を吹く風。xが正なら右へ、負なら左へ吹く。葉や草はこれを読んで流れる・なびく
export class Wind {
    x = 0;

    // frameフレームかけて、風の強さをtoへ変える
    *change(to: number, frame: number): Generator<void, void, void> {
        const from = this.x
        for (let i = 1; i <= frame; i++) {
            this.x = from + (to - from) * Ease.InOut(i / frame)
            yield
        }
    }
}
