import { Ease } from "@ipota/functions"
import { Vec, vec } from "@ipota/vec"
import { T } from "../../../T"
import { Ctx } from "../../../utils/Functions/Ctx"

const GOLD = "236, 206, 116"
const IVORY = "255, 244, 220"

// 一掃の見た目。自機のまわりで輪が縮み(gather)、波が出る瞬間に画面が光り(flash)、
// 鐘を打つように金色の波が広がり(draw)、打たれた場所には響きが輪になって残って消えていく。
// elapsedは、波が画面のいちばん遠い角に届く瞬間を1とした経過時間で、届いたあとも増え続ける。
// 波の先端より外には何も描かない。弾を花粉に変える境界と、見える境界が一致する。
export namespace SweepBell {
    // 波の先端が透明になりきるelapsed
    const FRONT_LIFE = 1.5
    // 最初の波紋が広がり始めるelapsed、波紋どうしの間隔、波紋ひとつが広がって透明になりきるまでの長さ
    const ECHO_START = 0.4
    const ECHO_GAP = 0.55
    const ECHO_LIFE = 1
    const ECHO_COUNT = 4

    // 最後の波紋まで含めて、すべてが透明になりきるelapsed。これ以降、drawは何も描かない
    export const END = Math.max(FRONT_LIFE, ECHO_START + ECHO_GAP * (ECHO_COUNT - 1) + ECHO_LIFE)

    // 波が出る直前のため。自機のまわりで三重の輪が加速しながら縮み、縮むほど濃くなる。
    // いちばん外の輪の内側には刻み目が並び、輪とともに縮んで、中心に寄ると薄れる。
    // progressは、ための始まりを0、波が出る瞬間を1とする
    export function gather(ctx: CanvasRenderingContext2D, center: Vec, progress: number) {
        const shrink = 1 - Ease.In(progress)

        for (let k = 0; k < 3; k++) {
            ctx.globalAlpha = progress * 0.7 ** k
            Ctx.arc(ctx, center, 8 + 120 * (1 + 0.6 * k) * shrink, k === 0 ? `rgb(${GOLD})` : `rgb(${IVORY})`, {
                lineWidth: k === 0 ? 2 : 1,
            })
        }

        const outer = 8 + 120 * shrink
        ctx.globalAlpha = progress * Math.min(1, outer / 60)
        ctx.strokeStyle = `rgb(${IVORY})`
        ctx.lineWidth = 1
        for (let i = 0; i < 24; i++) {
            const direction = vec.arg((i * T) / 24 + progress)
            const from = center.add(direction.scale(outer - 9))
            const to = center.add(direction.scale(outer - 3))
            ctx.beginPath()
            ctx.moveTo(from.x, from.y)
            ctx.lineTo(to.x, to.y)
            ctx.stroke()
        }
    }

    // 波が出る瞬間、画面全体が象牙色に光り、急に薄れて消える。波の輪はこの光の上に描かれる。
    // progressは、光り始めを0、消える瞬間を1とする
    export function flash(ctx: CanvasRenderingContext2D, width: number, height: number, progress: number) {
        ctx.globalAlpha = 0.55 * (1 - progress) ** 2
        ctx.fillStyle = `rgb(${IVORY})`
        ctx.fillRect(0, 0, width, height)
    }

    export function draw(ctx: CanvasRenderingContext2D, center: Vec, far: number, radius: number, elapsed: number) {
        const fade = Math.max(0, 1 - elapsed / FRONT_LIFE) ** 1.5

        glow(ctx, center, radius, fade)
        front(ctx, center, radius, elapsed, fade)
        echoes(ctx, center, far, elapsed)
    }

    // 波の内側をうっすら満たす光。先端に近いほど明るく、中心へ向かって透けていく
    function glow(ctx: CanvasRenderingContext2D, center: Vec, radius: number, fade: number) {
        if (radius <= 0) return

        const gradient = ctx.createRadialGradient(center.x, center.y, radius * 0.4, center.x, center.y, radius)
        gradient.addColorStop(0, `rgba(${GOLD}, 0)`)
        gradient.addColorStop(1, `rgba(${IVORY}, 0.3)`)

        ctx.globalAlpha = fade
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(center.x, center.y, radius, 0, T)
        ctx.fill()
    }

    // 波の先端の金の輪。そのすぐ内側に、鐘の余韻のように細い輪が間を置いて並び、遠いものほど薄い。
    // 輪のすぐ内側には短い刻み目が並び、ゆっくり回る
    function front(ctx: CanvasRenderingContext2D, center: Vec, radius: number, elapsed: number, fade: number) {
        ctx.globalAlpha = fade
        Ctx.arc(ctx, center, radius - 8, `rgba(${GOLD}, 0.25)`, { lineWidth: 16 })
        Ctx.arc(ctx, center, radius - 2, `rgb(${GOLD})`, { lineWidth: 4 })

        for (let k = 1; k <= 4; k++) {
            ctx.globalAlpha = fade * 0.6 ** k
            Ctx.arc(ctx, center, radius * (1 - 0.08 * k), `rgb(${IVORY})`, { lineWidth: 1.5 })
        }

        ctx.globalAlpha = fade * Math.min(1, radius / 200)
        ctx.strokeStyle = `rgb(${IVORY})`
        ctx.lineWidth = 1
        for (let i = 0; i < 48; i++) {
            const direction = vec.arg((i * T) / 48 + elapsed * 0.4)
            const from = center.add(direction.scale(radius - 14))
            const to = center.add(direction.scale(radius - 5))
            ctx.beginPath()
            ctx.moveTo(from.x, from.y)
            ctx.lineTo(to.x, to.y)
            ctx.stroke()
        }
    }

    // 打たれた場所から、輪が間を置いて順に広がる。あとのものほど薄く、広がりきったところで透明になる
    function echoes(ctx: CanvasRenderingContext2D, center: Vec, far: number, elapsed: number) {
        for (let k = 0; k < ECHO_COUNT; k++) {
            const progress = (elapsed - ECHO_START - ECHO_GAP * k) / ECHO_LIFE
            if (progress < 0 || progress >= 1) continue

            ctx.globalAlpha = (1 - progress) * 0.4 * 0.75 ** k
            Ctx.arc(ctx, center, far * 0.35 * Ease.Out(progress), `rgb(${GOLD})`, { lineWidth: 2 })
        }
    }
}
