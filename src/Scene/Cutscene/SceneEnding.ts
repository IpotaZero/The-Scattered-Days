import { GenUtils } from "@ipota/functions"
import { seededRandom } from "../../utils/Functions/seededRandom"
import { Scene } from "../../utils/Scene/Scene"
import { SceneCutscene } from "./SceneCutscene"
import { SideBee } from "./SideBee"
import { Snowflake } from "./Snowflake"
import { Svg } from "./Svg"
import { Tree } from "./Tree"
import { Wind } from "./Wind"

/**
 * ED。冬の夕暮れ。雪の降る中、右に立つ大きな木の根元へ、蜂が左から雪の上をゆっくり歩いてくる。
 * 途中で一度立ち止まって触角を動かし翅を震わせるが、飛ばずにまた歩き出す。
 * 根元までたどり着くと、脚を縮めて横たわる。蜂の背に雪が一つずつ積もり、手前の雪がだんだん蜂の下のほうを埋める。
 * やがて画面が雪の白になり、タイトルへ移る。
 */
export class SceneEnding extends SceneCutscene {
    private readonly wind = new Wind()
    private readonly bee = new SideBee(SideBee.STAND, false)
    private readonly farSnow: SVGGElement
    private readonly midSnow: SVGGElement
    private readonly shadow: SVGGElement
    private readonly drift: SVGPathElement
    private readonly nearSnow: SVGGElement

    constructor() {
        super("ending")

        // 雪の原は地平線(y=-40)から手前へ向かって明るくなる
        this.layer("cutscene-defs", 0).innerHTML = `
            <defs>
                <linearGradient id="cutscene-snowfield" gradientUnits="userSpaceOnUse" x1="0" y1="-40" x2="0" y2="300">
                    <stop offset="0" style="stop-color: color-mix(in srgb, var(--paper) 45%, var(--night))" />
                    <stop offset="1" style="stop-color: color-mix(in srgb, var(--paper) 85%, var(--night))" />
                </linearGradient>
            </defs>
        `
        // 遠くの雪は地平線のあたりで雪の原の向こうへ消える
        this.farSnow = this.layer("cutscene-snow", 0)

        const farTrees = this.layer("cutscene-far-trees", 0)
        farTrees.append(
            new Tree(-430, -36, 150, 5, seededRandom(3)).el,
            new Tree(-290, -40, 110, 5, seededRandom(11)).el,
            new Tree(-90, -38, 170, 5, seededRandom(5)).el,
            new Tree(110, -44, 90, 5, seededRandom(8)).el,
        )

        this.layer("cutscene-snowfield", 0).innerHTML = `
            <path d="M-600 -40 C-300 -55 -100 -30 150 -45 S450 -50 600 -38 L600 600 L-600 600 Z" fill="url(#cutscene-snowfield)" />
        `

        // 右に立つ大きな木の根元。幹は画面の上の外まで伸び、左へ細い根を這わせる。
        // 風上の左の縁と根の上には雪が付き、幹の裾(x=-20より右)は雪に埋もれている
        this.layer("cutscene-root", 0).innerHTML = `
            <path class="cutscene-trunk" d="M190 -520 C185 -250 180 -40 150 60 C130 115 90 140 30 152 L600 160 L600 -520 Z" />
            <path class="cutscene-trunk" d="M130 126 C60 134 0 145 -70 153 C-10 157 60 157 140 152 Z" />
            <path class="cutscene-bark" d="M235 -520 C232 -200 226 0 208 90 M300 -520 C300 -200 296 20 282 125 M375 -520 C380 -200 377 40 368 145 M450 -520 C455 -200 452 60 448 150" />
            <path class="cutscene-snow-cap" d="M193 -420 C189 -200 184 -40 156 55" />
            <path class="cutscene-snow-cap" d="M128 124 C60 132 0 143 -66 152" />
            <path d="M-20 158 C40 146 120 140 220 146 S450 150 600 146 L600 600 L-20 600 Z" fill="url(#cutscene-snowfield)" />
        `

        this.midSnow = this.layer("cutscene-snow", 0)
        this.shadow = this.layer("cutscene-shadow", 1)
        this.shadow.innerHTML = `<ellipse cx="-5" cy="0" rx="60" ry="5" />`
        this.layer("cutscene-bee", 0).append(this.bee.el)

        // だんだん高く積もっていく手前の雪
        this.drift = document.createElementNS(Svg.NS, "path")
        this.drift.setAttribute("fill", "url(#cutscene-snowfield)")
        this.layer("cutscene-drift", 0).append(this.drift)
        this.pile(0)

        // 右下の画面の外から手前へ伸びる、ぼけた根
        this.layer("cutscene-front-root", 2).innerHTML = `
            <path class="cutscene-trunk" d="M600 200 C480 190 340 200 250 300 L600 300 Z" />
            <path class="cutscene-snow-cap" d="M560 196 C460 192 340 205 262 290" />
        `

        this.nearSnow = this.layer("cutscene-snow", 2)

        this.wind.x = 0.12
        // STANDの形の足先(y=27)が、雪の上(y=150)に着く高さ
        this.bee.x = -300
        this.bee.y = 150 - 27 * 1.5
        this.bee.scale = 1.5
        this.bee.render()
    }

    protected *script(): Generator<void, void, void> {
        this.queue.add(() => this.followShadow())
        for (let i = 0; i < 40; i++) this.snow(Math.random() * 800 - 520)
        this.queue.add(() => this.snowing())

        yield* this.fade("var(--night)", 1, 0, 150)
        yield* this.bee.walk(-150, 0.7)
        yield* GenUtils.waitFrames(30)
        yield* this.bee.antennaeTo(-12, 20)
        yield* this.bee.antennaeTo(8, 30)
        yield* this.bee.antennaeTo(0, 20)
        yield* this.bee.buzz(26, 30)
        yield* GenUtils.waitFrames(50)
        yield* this.bee.walk(10, 0.5)
        yield* GenUtils.waitFrames(70)

        // 横たわる。脚を縮め、体を沈めて頭を雪へ傾け、触角を垂らす
        yield* GenUtils.all({
            legs: this.bee.changeLegs(SideBee.STAND, SideBee.CURLED, 150),
            body: this.bee.moveTo(this.bee.x, this.bee.y + 13, 7, 150),
            antennae: this.bee.antennaeTo(30, 150),
        })

        yield* GenUtils.all({
            settle: this.settle(),
            pileUp: this.pileUp(),
            end: GenUtils.sequence([GenUtils.waitFrames(400), this.fade("var(--paper)", 0, 1, 210)]),
        })
    }

    protected next(): Promise<Scene> {
        return import("../SceneTitle").then(({ SceneTitle }) => new SceneTitle())
    }

    // 影は蜂の真下の雪の上に付いていく
    private *followShadow(): Generator<void, void, void> {
        for (;;) {
            Svg.place(this.shadow, this.bee.x, 152, 0, 1, 1)
            yield
        }
    }

    // 降る雪を、6フレームごとに1片ずつ、110片まで増やしていく
    private *snowing(): Generator<void, void, void> {
        for (let i = 0; i < 110; i++) {
            this.snow(-520 - Math.random() * 40)
            yield* GenUtils.waitFrames(6)
        }
    }

    // 6割は遠く、3割ほどは蜂のあたり、残りは手前のぼけた雪として、高さyから1片降らせる
    private snow(y: number) {
        const r = Math.random()
        const x = Math.random() * 1120 - 560
        if (r < 0.6) {
            const flake = new Snowflake(this.farSnow, 0.4 + Math.random() * 0.3)
            this.queue.add(() => flake.fall(this.wind, x, y, -40 + Math.random() * 60))
        } else if (r < 0.92) {
            const flake = new Snowflake(this.midSnow, 0.9 + Math.random() * 0.6)
            this.queue.add(() => flake.fall(this.wind, x, y, 100 + Math.random() * 100))
        } else {
            const flake = new Snowflake(this.nearSnow, 3 + Math.random() * 2.5)
            this.queue.add(() => flake.fall(this.wind, x, y, 560))
        }
    }

    // 横たわった蜂の背(胸・たたんだ翅・頭・腹の先の上)に、雪が45フレームごとに一つずつ積もる
    private *settle(): Generator<void, void, void> {
        for (const [x, y] of [
            [12, -19],
            [4, -20],
            [-6, -22.5],
            [-17, -23],
            [-27, -22],
            [-36, -17],
            [28, -12.5],
            [-46, -4],
        ].sort(() => Math.random() - 0.5)) {
            const lump = Svg.g("cutscene-settled-snow", `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="1.8" />`)
            lump.style.opacity = "0"
            this.bee.el.append(lump)
            this.queue.add(() => this.appear(lump, 60))
            yield* GenUtils.waitFrames(45)
        }
    }

    private *appear(el: SVGGElement, frame: number): Generator<void, void, void> {
        for (let i = 1; i <= frame; i++) {
            el.style.opacity = `${i / frame}`
            yield
        }
    }

    // 600フレームかけて、手前の雪を32だけ高く積もらせる
    private *pileUp(): Generator<void, void, void> {
        for (let i = 1; i <= 600; i++) {
            this.pile((i / 600) * 32)
            yield
        }
    }

    // 手前の雪の上の縁を、はじめの高さ(y=158~170)よりheightだけ上げる
    private pile(height: number) {
        this.drift.setAttribute(
            "d",
            `M-600 ${168 - height} C-300 ${160 - height} -100 ${170 - height} 60 ${166 - height} S300 ${158 - height} 600 ${165 - height} L600 600 L-600 600 Z`,
        )
    }
}
