import { Svg } from "./Svg"
import { Wind } from "./Wind"

/**
 * 1片の雪。半径1.6を1として、depth倍の大きさで描く。depthが大きいほど手前にあり、大きく速く落ちる。
 */
export class Snowflake {
    private readonly el: SVGGElement

    constructor(
        layer: SVGGElement,
        private readonly depth: number,
    ) {
        this.el = Svg.g("cutscene-snowflake", `<circle r="1.6" />`)
        layer.append(this.el)
    }

    // (x, y)から、風に流されゆらゆらと揺れながら落ちる。groundより下へ行くと、また画面の上の外から降り直す。止まらない
    *fall(wind: Wind, x: number, y: number, ground: number): Generator<void, void, void> {
        const phase = Math.random() * Math.PI * 2
        for (let i = 0; ; i++) {
            x += wind.x * this.depth + Math.sin(i * 0.02 + phase) * 0.25 * this.depth
            y += 0.35 + this.depth * 0.45
            if (x > 560) x -= 1120
            if (x < -560) x += 1120
            if (y > ground) {
                x = Math.random() * 1120 - 560
                y = -520 - Math.random() * 40
            }

            Svg.place(this.el, x, y, 0, this.depth, this.depth)
            yield
        }
    }
}
