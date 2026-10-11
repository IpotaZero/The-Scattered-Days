import { Ease } from "@ipota/functions"
import { Svg } from "./Svg"

// 脚1本の、付け根から順に腿・脛・跗節の向き(度)。0が頭の向き、90が真下
type Leg = readonly [number, number, number]

// 片側3本(前脚・中脚・後脚)の脚の形
export type LegPose = { readonly front: Leg; readonly mid: Leg; readonly hind: Leg }

// 翅1組(前翅・後翅)。付け根を(0,0)として、後ろ(-x)へ伸ばして描く
const WING = `
    <path d="M0 0 C-10 -9 -36 -12 -47 -5 C-51 -1 -44 3 0 2 Z" />
    <path d="M-1 3 C-12 0 -28 0 -33 4 C-34 8 -22 8 -1 5 Z" />
`

/**
 * 横から見た蜂のシルエット。頭が右(+x)を向き、胸と腹のつなぎ目が(0,0)になるように描いてある。
 * 針の先から触角の先までが-60~56。STANDの形で立つと、足先がy=27あたりに着く。
 * 色はcssのcolorで決まる。後ろ脚の花粉だけは金色。
 */
export class SideBee {
    // 脚を下ろしたまま飛んでいるときの形
    static readonly HOVER: LegPose = { front: [70, 120, 90], mid: [110, 70, 115], hind: [135, 95, 130] }
    // 地面に立っているときの形
    static readonly STAND: LegPose = { front: [30, 100, 15], mid: [160, 100, 175], hind: [170, 115, 175] }
    // 脚を縮めて体の下に抱えた形
    static readonly CURLED: LegPose = { front: [60, -20, -100], mid: [80, 10, 300], hind: [120, 20, 280] }

    // 脚の付け根の位置と、腿・脛・跗節の長さ。奥の脚は付け根を(-4,-2)ずらし、どの向きも6度ずらして描く
    private static readonly LEGS = {
        front: { root: [24, 6], lengths: [11, 11, 9] },
        mid: { root: [14, 9], lengths: [13, 13, 11] },
        hind: { root: [4, 8], lengths: [15, 17, 13] },
    } as const

    readonly el: SVGGElement
    x = 0
    y = 0
    deg = 0
    scale = 1
    // 1なら右、-1なら左を向く。間の値では横に縮み、向きを変えている途中に見える
    facing = 1

    private readonly nearLegs: SVGPathElement[]
    private readonly farLegs: SVGPathElement[]
    private readonly pollen: SVGEllipseElement | null
    private readonly wing: SVGGElement
    // 羽ばたいている翅の残像。羽ばたいていない間は見えない
    private readonly fan: SVGGElement
    private readonly antennae: SVGGElement
    private antennaeDeg = 0

    constructor(legs: LegPose, pollen: boolean) {
        // 胸の毛。胸の上半分の縁から外へ短い線を立てる
        let hair = ""
        for (let a = 195; a <= 345; a += 15) {
            const r = (a * Math.PI) / 180
            hair += `M${12 + Math.cos(r) * 14} ${-3 + Math.sin(r) * 13} L${12 + Math.cos(r) * 18} ${-3 + Math.sin(r) * 16.5} `
        }

        this.el = Svg.g(
            "side-bee",
            `
            <g class="side-bee-far">
                <path class="side-bee-leg" stroke-width="2.2" />
                <path class="side-bee-leg" stroke-width="2.2" />
                <path class="side-bee-leg" stroke-width="2.8" />
            </g>
            <g class="side-bee-wing-fan">
                ${[-10, 8, 26, 44, 62].map((a) => `<g transform="translate(12 -17) rotate(${a})">${WING}</g>`).join("")}
            </g>
            <g class="side-bee-wing">${WING}</g>
            <g transform="rotate(-14 -27 5)">
                <ellipse cx="-27" cy="5" rx="26" ry="17" />
                <path class="side-bee-stripe" d="M-15 -10.08 Q-19 5 -15 20.08 M-26 -11.99 Q-30 5 -26 21.99 M-37 -10.69 Q-41 5 -37 20.69 M-46 -6.6 Q-49 5 -46 16.6" />
            </g>
            <path d="M-49 8 L-60 14.5 L-48 14 Z" />
            <ellipse cx="-1" cy="1" rx="5" ry="4.5" />
            <ellipse cx="12" cy="-3" rx="15" ry="14" />
            <path class="side-bee-line" stroke-width="1.3" d="${hair}" />
            <ellipse cx="31" cy="0" rx="9" ry="11.5" transform="rotate(20 31 0)" />
            <ellipse class="side-bee-eye" cx="32" cy="-2" rx="4" ry="7.5" transform="rotate(20 31 0)" />
            <path class="side-bee-line" stroke-width="1.6" d="M34 9 L36.5 14" />
            <g class="side-bee-antennae">
                <path class="side-bee-line side-bee-far" stroke-width="1.6" d="M33 -9 L36 -22 Q43 -28 51 -24" />
                <path class="side-bee-line" stroke-width="1.6" d="M35 -9 L41 -21 Q49 -25 56 -17" />
            </g>
            <g class="side-bee-near">
                <path class="side-bee-leg" stroke-width="2.2" />
                <path class="side-bee-leg" stroke-width="2.2" />
                <path class="side-bee-leg" stroke-width="2.8" />
            </g>
            ${pollen ? `<ellipse class="side-bee-pollen" rx="4.5" ry="3.2" />` : ""}
        `,
        )

        this.farLegs = Array.from(this.el.querySelectorAll<SVGPathElement>(".side-bee-far .side-bee-leg"))
        this.nearLegs = Array.from(this.el.querySelectorAll<SVGPathElement>(".side-bee-near .side-bee-leg"))
        this.pollen = this.el.querySelector<SVGEllipseElement>(".side-bee-pollen")
        this.wing = this.el.querySelector<SVGGElement>(".side-bee-wing")!
        this.fan = this.el.querySelector<SVGGElement>(".side-bee-wing-fan")!
        this.antennae = this.el.querySelector<SVGGElement>(".side-bee-antennae")!

        this.legsTo(legs, legs)
        this.wingsTo(-8)
        this.fan.style.opacity = "0"
    }

    static blend(a: LegPose, b: LegPose, t: number): LegPose {
        const leg = (p: Leg, q: Leg): Leg => [
            p[0] + (q[0] - p[0]) * t,
            p[1] + (q[1] - p[1]) * t,
            p[2] + (q[2] - p[2]) * t,
        ]
        return { front: leg(a.front, b.front), mid: leg(a.mid, b.mid), hind: leg(a.hind, b.hind) }
    }

    // 歩いている間の脚の形。前脚と後脚、中脚は逆の拍子で前後に振り、前へ振っている間は脚を上げる。strideが0ならSTANDのまま
    private static gait(phase: number, stride: number): LegPose {
        const swing = (leg: Leg, offset: number): Leg => {
            const s = Math.sin(phase + offset) * stride
            const lift = Math.max(0, Math.cos(phase + offset)) * stride
            return [leg[0] - s * 14, leg[1] - s * 8 - lift * 14, leg[2] - lift * 10]
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

    legsTo(near: LegPose, far: LegPose) {
        const parts = ["front", "mid", "hind"] as const
        parts.forEach((part, i) => {
            const { root, lengths } = SideBee.LEGS[part]
            const joints = this.drawLeg(this.nearLegs[i]!, root[0], root[1], lengths, near[part], 0)
            this.drawLeg(this.farLegs[i]!, root[0] - 4, root[1] - 2, lengths, far[part], 6)

            // 花粉は手前の後ろ脚の脛の真ん中に、脛に沿わせて付ける
            if (part !== "hind" || !this.pollen) return
            const cx = (joints[0]!.x + joints[1]!.x) / 2
            const cy = (joints[0]!.y + joints[1]!.y) / 2
            this.pollen.setAttribute("transform", `translate(${cx} ${cy}) rotate(${near.hind[1]})`)
        })
    }

    wingsTo(deg: number) {
        this.wing.setAttribute("transform", `translate(12 -17) rotate(${deg})`)
    }

    // frameフレームの間、翅を-10度から-10+amplitude度の間で震わせる。
    // amplitudeが40を超えると-10~62度に扇のような残像が出て、80で最も濃くなる。終わると翅をたたむ
    *buzz(frame: number, amplitude: number): Generator<void, void, void> {
        this.fan.style.opacity = `${Math.max(0, amplitude - 40) / 40}`
        for (let i = 0; i < frame; i++) {
            this.wingsTo(-10 + Math.random() * amplitude)
            yield
        }
        this.fan.style.opacity = "0"
        this.wingsTo(-8)
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

            this.legsTo(SideBee.gait(phase, stride), SideBee.gait(phase + Math.PI, stride))
            this.y = baseY - Math.abs(Math.sin(phase)) * 0.6 * this.scale * stride
            this.render()
            yield
        }

        this.y = baseY
        this.legsTo(SideBee.STAND, SideBee.STAND)
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
            const pose = SideBee.blend(from, to, Ease.InOut(i / frame))
            this.legsTo(pose, pose)
            yield
        }
    }

    // frameフレームかけて、触角を付け根を軸にdeg度まで回す。正なら下がる
    *antennaeTo(deg: number, frame: number): Generator<void, void, void> {
        const from = this.antennaeDeg
        for (let i = 1; i <= frame; i++) {
            this.antennaeDeg = from + (deg - from) * Ease.InOut(i / frame)
            this.antennae.setAttribute("transform", `rotate(${this.antennaeDeg} 34 -9)`)
            yield
        }
    }

    // 付け根(x, y)から腿・脛・跗節を順につなぐ。曲がり目と足先の位置を返す
    private drawLeg(
        path: SVGPathElement,
        x: number,
        y: number,
        lengths: readonly number[],
        leg: Leg,
        offsetDeg: number,
    ): { x: number; y: number }[] {
        const joints: { x: number; y: number }[] = []
        let d = `M${x} ${y}`
        leg.forEach((deg, i) => {
            const r = ((deg + offsetDeg) * Math.PI) / 180
            x += Math.cos(r) * lengths[i]!
            y += Math.sin(r) * lengths[i]!
            d += ` L${x} ${y}`
            joints.push({ x, y })
        })
        path.setAttribute("d", d)
        return joints
    }
}
