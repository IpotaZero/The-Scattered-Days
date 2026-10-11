import { Svg } from "./Svg"

/**
 * 葉のない木のシルエット。根元(x, y)から幹を立て、枝分かれをdepth回くり返す。
 * 高さはおよそheightになる。同じrandomからは同じ形の木ができる。色はcssのcolorで決まる。
 */
export class Tree {
    readonly el: SVGGElement
    // 枝先の位置
    readonly tips: { x: number; y: number }[] = []

    constructor(
        x: number,
        y: number,
        height: number,
        depth: number,
        private readonly random: () => number,
    ) {
        const width = height * 0.07
        // 根元は地面へ向けて裾を広げる
        const flare = `<path class="cutscene-tree-flare" d="M${x - width * 1.6} ${y} Q${x - width * 0.6} ${y - width * 0.3} ${x - width * 0.45} ${y - width * 2} L${x + width * 0.45} ${y - width * 2} Q${x + width * 0.6} ${y - width * 0.3} ${x + width * 1.6} ${y} Z" />`
        this.el = Svg.g("cutscene-tree", flare + this.grow(x, y, -Math.PI / 2 - 0.05, height * 0.36, width, depth, 0))
    }

    // (x, y)からangleの向きへ長さlength・太さwidthの枝を伸ばし、その先から細く短い枝を2~3本伸ばす。bendが大きいほど枝が曲がる
    private grow(
        x: number,
        y: number,
        angle: number,
        length: number,
        width: number,
        depth: number,
        bend: number,
    ): string {
        const ex = x + Math.cos(angle) * length
        const ey = y + Math.sin(angle) * length
        const cx = (x + ex) / 2 + Math.cos(angle + Math.PI / 2) * length * bend
        const cy = (y + ey) / 2 + Math.sin(angle + Math.PI / 2) * length * bend
        let content = `<path d="M${x} ${y} Q${cx} ${cy} ${ex} ${ey}" stroke-width="${width}" />`

        if (depth === 0) {
            this.tips.push({ x: ex, y: ey })
            return content
        }

        // 太い枝ほど3本に分かれやすい。分かれた枝は少しずつ真上へ向き直る
        const spreads = depth > 3 && this.random() < 0.35 ? [-1, 0, 1] : [-1, 1]
        for (const spread of spreads) {
            const childAngle = angle + spread * (0.3 + this.random() * 0.3) + (-Math.PI / 2 - angle) * 0.15
            content += this.grow(
                ex,
                ey,
                childAngle,
                length * (0.68 + this.random() * 0.1),
                width * 0.68,
                depth - 1,
                (this.random() - 0.5) * 0.15,
            )
        }
        return content
    }
}
