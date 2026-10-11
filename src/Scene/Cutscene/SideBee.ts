import { Ease } from "@ipota/functions"
import { Svg } from "./Svg"

// 脚1本の、付け根から順に腿・脛の向き(度)。0が頭の向き、90が真下
type Leg = readonly [number, number]

// 3本(前脚・中脚・後脚)の脚の形
export type LegPose = { readonly front: Leg; readonly mid: Leg; readonly hind: Leg }

// 翅。付け根を(0,0)として、上(-y)へ伸ばして描く
const WING = `<ellipse cx="0" cy="-24" rx="13" ry="24" />`

/**
 * 横から見た蜂のシルエット(assets/image/bug/bee.svgを5倍にして、脚を足したもの)。
 * 頭が右(+x)を向き、体の楕円の中心の少し右が(0,0)になる。針の先から触角の先までが-50~55。
 * STANDの形で立つと、足先がy=37あたりに着く。色はcssのcolorで決まる。
 */
export class SideBee {
    // 脚を下ろしたまま飛んでいるときの形
    static readonly HOVER: LegPose = { front: [70, 110], mid: [100, 95], hind: [130, 110] }
    // 地面に立っているときの形
    static readonly STAND: LegPose = { front: [45, 95], mid: [155, 120], hind: [165, 125] }
    // 脚を縮めて体の下に抱えた形
    static readonly CURLED: LegPose = { front: [20, -60], mid: [30, -40], hind: [20, -30] }

    // 脚の付け根の位置と、腿・脛の長さ
    private static readonly LEGS = {
        front: { root: [16, 14], lengths: [12, 14] },
        mid: { root: [6, 18], lengths: [13, 15] },
        hind: { root: [-4, 20], lengths: [14, 17] },
    } as const

    readonly el: SVGGElement
    x = 0
    y = 0
    deg = 0
    scale = 1
    // 1なら右、-1なら左を向く。間の値では横に縮み、向きを変えている途中に見える
    facing = 1

    private readonly legs: SVGPathElement[]
    private readonly wing: SVGGElement
    // 羽ばたいている翅の残像。羽ばたいていない間は見えない
    private readonly fan: SVGGElement
    private readonly antenna: SVGPathElement
    private antennaDeg = 0

    constructor(legs: LegPose) {
        this.el = Svg.g(
            "side-bee",
            `
            <g class="side-bee-wing-fan">
                ${[-55, -35, -15, 5, 25].map((a) => `<g transform="translate(2 -18) rotate(${a})">${WING}</g>`).join("")}
            </g>
            <g class="side-bee-wing">${WING}</g>
            <ellipse cx="-5" cy="0" rx="32.5" ry="22.5" />
            <circle cx="30" cy="-5" r="14" />
            <path d="M-35 0 L-50 3 L-35 8 Z" />
            <path class="side-bee-line side-bee-antenna" d="M35 -15 Q45 -35 55 -37.5" />
            <path class="side-bee-line" />
            <path class="side-bee-line" />
            <path class="side-bee-line" />
        `,
        )

        this.legs = Array.from(this.el.querySelectorAll<SVGPathElement>(".side-bee-line:not(.side-bee-antenna)"))
        this.wing = this.el.querySelector<SVGGElement>(".side-bee-wing")!
        this.fan = this.el.querySelector<SVGGElement>(".side-bee-wing-fan")!
        this.antenna = this.el.querySelector<SVGPathElement>(".side-bee-antenna")!

        this.legsTo(legs)
        this.wingsTo(-95)
        this.fan.style.opacity = "0"
    }

    static blend(a: LegPose, b: LegPose, t: number): LegPose {
        const leg = (p: Leg, q: Leg): Leg => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
        return { front: leg(a.front, b.front), mid: leg(a.mid, b.mid), hind: leg(a.hind, b.hind) }
    }

    // 歩いている間の脚の形。前脚と後脚、中脚は逆の拍子で前後に振り、前へ振っている間は脚を上げる。strideが0ならSTANDのまま
    private static gait(phase: number, stride: number): LegPose {
        const swing = (leg: Leg, offset: number): Leg => {
            const s = Math.sin(phase + offset) * stride
            const lift = Math.max(0, Math.cos(phase + offset)) * stride
            return [leg[0] - s * 14, leg[1] - s * 8 - lift * 14]
        }
        return {
            front: swing(SideBee.STAND.front, 0),
            mid: swing(SideBee.STAND.mid, Math.PI),
            hind: swing(SideBee.STAND.hind, 0),
        }
    }

    render() {
        Svg.place(this.el, this.x, this.y, this.deg, this.scale * this.facing, this.scale)
    }

    // 付け根から腿・脛を順につなぐ
    legsTo(pose: LegPose) {
        const parts = ["front", "mid", "hind"] as const
        parts.forEach((part, i) => {
            const { root, lengths } = SideBee.LEGS[part]
            let x = root[0]
            let y = root[1]
            let d = `M${x} ${y}`
            pose[part].forEach((deg, j) => {
                x += Math.cos((deg * Math.PI) / 180) * lengths[j]!
                y += Math.sin((deg * Math.PI) / 180) * lengths[j]!
                d += ` L${x} ${y}`
            })
            this.legs[i]!.setAttribute("d", d)
        })
    }

    // 翅を付け根(2,-18)を軸にdeg度回す。0で真上に立ち、-95で体の上に後ろ向きにたたまれる
    wingsTo(deg: number) {
        this.wing.setAttribute("transform", `translate(2 -18) rotate(${deg})`)
    }

    // frameフレームの間、翅を-55度から-55+amplitude度の間で震わせる。
    // amplitudeが40を超えると-55~25度に扇のような残像が出て、80で最も濃くなる。終わると翅をたたむ
    *buzz(frame: number, amplitude: number): Generator<void, void, void> {
        this.fan.style.opacity = `${Math.max(0, amplitude - 40) / 40}`
        for (let i = 0; i < frame; i++) {
            this.wingsTo(-55 + Math.random() * amplitude)
            yield
        }
        this.fan.style.opacity = "0"
        this.wingsTo(-95)
    }

    // xがtoXに着くまで、1フレームに最大speedずつ歩く。歩き出しと着く手前では歩幅が狭くなる。着くとSTANDの形で止まる
    *walk(toX: number, speed: number): Generator<void, void, void> {
        const fromX = this.x
        const baseY = this.y
        const direction = Math.sign(toX - fromX)
        let phase = 0

        while ((toX - this.x) * direction > 0) {
            const stride = Math.min(1, Math.abs(this.x - fromX) / 20 + 0.2, Math.abs(toX - this.x) / 20 + 0.1)
            const step = Math.min(speed * stride, Math.abs(toX - this.x))
            this.x += step * direction
            phase += step / (this.scale * 1.9)

            this.legsTo(SideBee.gait(phase, stride))
            this.y = baseY - Math.abs(Math.sin(phase)) * 0.6 * this.scale * stride
            this.render()
            yield
        }

        this.y = baseY
        this.legsTo(SideBee.STAND)
        this.render()
    }

    // frameフレームかけて、(x, y)へ動き、deg度まで回る
    *moveTo(x: number, y: number, deg: number, frame: number): Generator<void, void, void> {
        const from = { x: this.x, y: this.y, deg: this.deg }
        for (let i = 1; i <= frame; i++) {
            const t = Ease.InOut(i / frame)
            this.x = from.x + (x - from.x) * t
            this.y = from.y + (y - from.y) * t
            this.deg = from.deg + (deg - from.deg) * t
            this.render()
            yield
        }
    }

    // frameフレームかけて、脚の形をfromからtoへ変える
    *changeLegs(from: LegPose, to: LegPose, frame: number): Generator<void, void, void> {
        for (let i = 1; i <= frame; i++) {
            this.legsTo(SideBee.blend(from, to, Ease.InOut(i / frame)))
            yield
        }
    }

    // frameフレームかけて、触角を付け根(35,-15)を軸にdeg度まで回す。正なら下がる
    *antennaTo(deg: number, frame: number): Generator<void, void, void> {
        const from = this.antennaDeg
        for (let i = 1; i <= frame; i++) {
            this.antennaDeg = from + (deg - from) * Ease.InOut(i / frame)
            this.antenna.setAttribute("transform", `rotate(${this.antennaDeg} 35 -15)`)
            yield
        }
    }
}
