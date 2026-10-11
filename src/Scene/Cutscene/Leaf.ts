import { Svg } from "./Svg"
import { Wind } from "./Wind"

/**
 * 1枚の葉。長さ12・幅7を1として、depth倍の大きさで描く。depthが大きいほど手前にあり、大きく速く流れる。
 * toneは色の名前(cssの.cutscene-leaf-{tone})。
 */
export class Leaf {
    private readonly el: SVGGElement

    constructor(
        layer: SVGGElement,
        private readonly depth: number,
        tone: string,
    ) {
        this.el = Svg.g(
            `cutscene-leaf cutscene-leaf-${tone}`,
            `
            <path d="M-6 0 Q-1 -4 6 0 Q-1 4 -6 0 Z" />
            <path class="cutscene-leaf-vein" d="M-6 0 Q0 -0.6 5 0" />
            <path class="cutscene-leaf-stem" d="M-6 0 L-8.5 0.8" />
        `,
        )
        layer.append(this.el)
    }

    // 枝先(x, y)にangle度の向きでぶら下がり、風に揺れる。風がstrengthより強いほど、また風がなくてもまれに、枝を離れて落ちる
    *hang(wind: Wind, x: number, y: number, angle: number, strength: number): Generator<void, void, void> {
        const phase = Math.random() * Math.PI * 2
        for (let i = 0; Math.random() > 0.0003 + Math.max(0, Math.abs(wind.x) - strength) * 0.01; i++) {
            const sway = Math.sin(i * 0.08 + phase) * (4 + Math.abs(wind.x) * 6)
            Svg.place(this.el, x, y, angle + sway, this.depth, this.depth)
            yield
        }

        yield* this.fall(wind, x, y, angle)
    }

    // (x, y)から、風に流されながら左右に揺れ、くるくると裏返りながら落ちる。風が強いほど落ちずに横へ飛ぶ。画面の外へ出ると消える
    *fall(wind: Wind, x: number, y: number, angle: number): Generator<void, void, void> {
        const phase = Math.random() * Math.PI * 2
        const flutter = 0.05 + Math.random() * 0.05
        const spin = (Math.random() - 0.5) * 6
        const margin = 600 + this.depth * 10
        let vx = 0
        let vy = 0

        for (let i = 0; Math.abs(x) < margin && y < margin; i++) {
            vx += (wind.x * (0.5 + this.depth * 0.6) - vx) * 0.04
            vy += (this.depth * (0.7 - Math.min(0.6, Math.abs(wind.x) * 0.13)) - vy) * 0.04
            x += vx + Math.cos(i * flutter + phase) * 0.9 * this.depth
            y += vy + Math.sin(i * flutter * 2 + phase) * 0.35 * this.depth
            angle += spin + Math.cos(i * flutter + phase) * 2

            Svg.place(this.el, x, y, angle, this.depth, this.depth * Math.cos(i * flutter * 1.3 + phase))
            yield
        }

        this.el.remove()
    }
}
