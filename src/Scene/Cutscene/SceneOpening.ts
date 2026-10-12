import { GenUtils } from "@ipota/functions"
import { seededRandom } from "../../utils/Functions/seededRandom"
import { Scene } from "../../utils/Scene/Scene"
import { Leaf } from "./Leaf"
import { SceneCutscene } from "./SceneCutscene"
import { SideBee } from "./SideBee"
import { Svg } from "./Svg"
import { Tree } from "./Tree"
import { Wind } from "./Wind"

/**
 * OP。秋の終わりの午後。奥に巣穴のある木が立ち、手前には大きな蜂が浮かんで木のほうを向いている。
 * 左へ吹く風がだんだん強まり、木の葉が散っていく。巣穴のまわりを飛んでいた小さな蜂は巣穴へ戻る。
 * いちばん強い風が吹くと、手前を大きな葉が次々に横切り、手前の蜂は振り返って左上へ飛び去る。
 */
export class SceneOpening extends SceneCutscene {
    private readonly wind = new Wind()
    private readonly bee = new SideBee(SideBee.HOVER)
    private readonly midLeaves: SVGGElement
    // 草むらの帯。手前の帯ほど大きく、帯の真ん中の高さ(base)を軸に傾く
    private readonly grassRows: { el: SVGGElement; base: number }[]
    private readonly nearLeaves: SVGGElement

    // 終わるか飛ばされると、nextが返す場面へ移る
    constructor(next: () => Promise<Scene>) {
        super("opening", next)
        this.root.classList.add("paper-scene")

        this.layer("cutscene-land", 0).innerHTML = `
            <defs>
                <radialGradient id="cutscene-sun">
                    <stop offset="0" style="stop-color: var(--gold); stop-opacity: 0.45" />
                    <stop offset="1" style="stop-color: var(--gold); stop-opacity: 0" />
                </radialGradient>
            </defs>
            <circle cx="300" cy="-250" r="520" fill="url(#cutscene-sun)" />
            <path class="cutscene-hills" d="M-600 120 C-400 90 -200 110 0 100 S350 70 600 95 L600 600 L-600 600 Z" />
            <path class="cutscene-ground" d="M-600 200 C-300 185 0 195 140 205 S450 196 600 190 L600 600 L-600 600 Z" />
        `

        // 幹は根元(140,205)からほぼ真上へy=61まで伸び、y=112のあたりでx=136を通る。そこに巣穴をあける。枝先はy=-263~-95に広がる
        const tree = new Tree(140, 205, 400, 6, seededRandom(6))
        tree.el.insertAdjacentHTML("beforeend", `<ellipse class="cutscene-hollow" cx="136" cy="112" rx="7" ry="10" />`)
        this.layer("cutscene-hive-tree", 0).append(tree.el)

        const hiveBees = this.layer("cutscene-hive-bees", 0)
        for (let i = 0; i < 4; i++) {
            const el = Svg.g("cutscene-hive-bee", `<ellipse rx="2.4" ry="1.5" />`)
            hiveBees.append(el)
            this.queue.add(() => this.visitHive(el, i * 1.6))
        }

        // 枝先ごとに1~2枚の葉を付ける。枝を離れやすさ(strength)は葉ごとに0~5で、
        // 風は4.2までしか強まらないので、strengthが4.2を超える葉(2割弱)は風では散らず、まれにしか落ちない
        const crown = this.layer("cutscene-leaves", 0)
        for (const tip of tree.tips) {
            for (let i = 0; i < (Math.random() < 0.6 ? 2 : 1); i++) {
                const leaf = new Leaf(
                    crown,
                    1.3,
                    ["yellow", "yellow", "amber", "amber", "brown", "green"][Math.floor(Math.random() * 6)]!,
                )
                this.queue.add(() =>
                    leaf.hang(
                        this.wind,
                        tip.x + (Math.random() - 0.5) * 28,
                        tip.y + (Math.random() - 0.5) * 28,
                        Math.random() * 360,
                        Math.random() * 5,
                    ),
                )
            }
        }

        this.midLeaves = this.layer("cutscene-leaves", 1)
        this.layer("cutscene-bee", 0).append(this.bee.el)
        // 草むらは奥(y=285)から画面の下の外(y=605)まで、8つの帯に分けて生やす。手前の帯ほど草が高く太く、色が濃い。
        // 16:9では一番奥の帯の穂先だけが映り、縦長の画面では手前の帯まで映る。草の間から見える地面は、手前ほど濃い
        const grass = this.layer("cutscene-grass", 1)
        grass.innerHTML = `
            <defs>
                <linearGradient id="cutscene-soil" gradientUnits="userSpaceOnUse" x1="0" y1="285" x2="0" y2="380">
                    <stop offset="0" style="stop-color: color-mix(in srgb, var(--forest) 55%, var(--sage)); stop-opacity: 0" />
                    <stop offset="1" style="stop-color: color-mix(in srgb, var(--forest) 55%, var(--sage)); stop-opacity: 1" />
                </linearGradient>
            </defs>
            <rect x="-600" y="285" width="1200" height="335" fill="url(#cutscene-soil)" />
        `
        this.grassRows = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
            const base = 285 + k * 40
            let blades = ""
            for (let i = 0; i < 70 + k * 12; i++) {
                const x = Math.random() * 1200 - 600
                const y = base + Math.random() * 40
                const h = (40 + (y - 250) * 0.45) * (0.6 + Math.random() * 0.8)
                const w = 2.5 + (y - 250) * 0.02 + Math.random() * 2
                const lean = (Math.random() - 0.5) * h * 0.6
                blades += `M${x - w} ${y} Q${x - w + lean * 0.3} ${y - h * 0.6} ${x + lean} ${y - h} Q${x + w + lean * 0.3} ${y - h * 0.6} ${x + w} ${y} Z `
            }
            const el = Svg.g("cutscene-grass-row", `<path d="${blades}" />`)
            el.style.fill = `color-mix(in srgb, var(--forest) ${45 + k * 8}%, var(--sage))`
            grass.append(el)
            return { el, base: base + 20 }
        })
        this.nearLeaves = this.layer("cutscene-leaves", 3)

        this.wind.x = -0.3
        this.bee.x = -230
        this.bee.y = 70
        this.bee.deg = -6
        this.bee.scale = 4.2
        this.bee.render()
    }

    protected *script(): Generator<void, void, void> {
        this.queue.add(() => this.bee.buzz(Infinity, 80))
        this.queue.add(() => this.hover(), { id: "bee" })
        this.queue.add(() => this.swayGrass())

        yield* this.fade("var(--paper)", 1, 0, 90)
        this.queue.add(() => new Leaf(this.nearLeaves, 5, "brown").fall(this.wind, 250, -560, 30))
        yield* this.wind.change(-1, 180)
        this.queue.add(() => new Leaf(this.midLeaves, 2.2, "amber").fall(this.wind, 300, -540, 120))
        yield* this.wind.change(-1.6, 60)
        yield* GenUtils.all({
            wind: this.wind.change(-4.2, 50),
            leaves: this.gust(),
            bee: GenUtils.sequence([GenUtils.waitFrames(60), this.depart()]),
        })
        yield* this.wind.change(-0.8, 150)
        yield* GenUtils.waitFrames(30)
        yield* this.fade("var(--paper)", 0, 1, 120)
    }

    // 巣穴のまわりを飛び回る。風の強さが2.5を超えると、巣穴へ入って見えなくなる
    private *visitHive(el: SVGGElement, phase: number): Generator<void, void, void> {
        let x = 136
        let y = 112
        for (let i = 0; Math.abs(this.wind.x) < 2.5; i++) {
            const a = i * 0.03 + phase
            x = 136 + Math.cos(a) * 30 + Math.sin(a * 2.7) * 8 + Math.sin(i * 0.4) * 2
            y = 106 + Math.sin(a * 1.3) * 18 + Math.cos(i * 0.5) * 1.5
            Svg.place(el, x, y, 0, 1, 1)
            yield
        }

        for (let i = 1; i <= 30; i++) {
            Svg.place(el, x + ((136 - x) * i) / 30, y + ((112 - y) * i) / 30, 0, 1 - i / 40, 1 - i / 40)
            yield
        }
        el.remove()
    }

    // 手前の蜂は同じところに浮かんだまま、ゆっくり上下に揺れる。風が強いほど風下へ押される
    private *hover(): Generator<void, void, void> {
        for (let i = 0; ; i++) {
            this.bee.x = -230 + this.wind.x * 4 + Math.sin(i * 0.017) * 6
            this.bee.y = 70 + Math.sin(i * 0.035) * 8
            this.bee.deg = -6 + Math.sin(i * 0.023) * 2.5
            this.bee.render()
            yield
        }
    }

    // 振り返って左を向き、左上へ飛び去る。飛びながら手前へ近づいて大きくなる
    private *depart(): Generator<void, void, void> {
        this.queue.remove("bee")

        const fromDeg = this.bee.deg
        for (let i = 1; i <= 16; i++) {
            this.bee.facing = Math.cos((Math.PI * i) / 16)
            this.bee.deg = fromDeg + (14 - fromDeg) * (i / 16)
            this.bee.render()
            yield
        }

        let vx = 0
        let vy = 0
        for (let i = 0; i < 80; i++) {
            vx -= 0.3
            vy -= 0.18
            this.bee.x += vx
            this.bee.y += vy
            this.bee.scale *= 1.006
            this.bee.render()
            yield
        }
    }

    // 草は風下へなびき、風がなくてもわずかに揺れる。手前の帯ほど大きく傾く
    private *swayGrass(): Generator<void, void, void> {
        for (let i = 0; ; i++) {
            const skew = -this.wind.x * 3 + Math.sin(i * 0.05) * 1.5
            this.grassRows.forEach(({ el, base }, k) => {
                el.setAttribute("transform", `translate(0 ${base}) skewX(${skew * (1 + k * 0.1)}) translate(0 ${-base})`)
            })
            yield
        }
    }

    // 強い風に乗って、手前と少し奥を、画面の右の外から葉が次々に横切る
    private *gust(): Generator<void, void, void> {
        for (let i = 0; i < 16; i++) {
            const near = new Leaf(this.nearLeaves, 4 + Math.random() * 4, Math.random() < 0.5 ? "brown" : "amber")
            const mid = new Leaf(this.midLeaves, 1.8 + Math.random(), Math.random() < 0.5 ? "yellow" : "amber")
            this.queue.add(() => near.fall(this.wind, 560, -320 + Math.random() * 600, Math.random() * 360))
            this.queue.add(() => mid.fall(this.wind, 560, -300 + Math.random() * 560, Math.random() * 360))
            yield* GenUtils.waitFrames(6 + Math.floor(Math.random() * 10))
        }
    }
}
