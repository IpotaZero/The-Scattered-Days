import { vec, Vec } from "@ipota/vec"
import { T } from "../../T"
import { Ctx } from "../../utils/Functions/Ctx"
import { Game } from "../Game"

// 当たり判定を持たない、回転しながら縮んで消えていく三角形の粒子。描画はgame.drawInWorldで予約する
export namespace TriangleParticle {
    // pからradian±0.75の向きへ初速speedで1つ飛ばし、20フレームで消える
    export function* scatter(
        game: Game,
        p: Vec,
        radian: number,
        speed: number,
        color: string,
    ): Generator<void, void, void> {
        const maxFrame = 20
        let v = vec.arg(radian + (Math.random() - 0.5) * 1.5).scale(speed)

        const size = Math.random() * 2 + 16
        let angle = Math.random() * T
        const angularVelocity = (Math.random() - 0.5) * 0.4

        for (let i = 0; i < maxFrame; i++) {
            draw(game, p, size * (1 - i / maxFrame), angle, (1 - i / maxFrame) * 0.6, color)

            p = p.add(v)
            v = v.scale(0.9)
            angle += angularVelocity

            yield
        }
    }

    // pから速度vで漂わせ、maxFrameで消える。大きさは変わらず、薄く(最大0.15)描かれる
    export function* drift(game: Game, p: Vec, v: Vec, maxFrame: number): Generator<void, void, void> {
        const size = Math.random() * 2 + 3
        let angle = Math.random() * T
        const angularVelocity = (Math.random() - 0.5) * 0.1

        for (let i = 0; i < maxFrame; i++) {
            draw(game, p, size, angle, (1 - i / maxFrame) * 0.3, "#e0e0e0")

            p = p.add(v)
            v = v.scale(0.96)
            angle += angularVelocity

            yield
        }
    }

    // 描画はyield後のdraw()で行われる。引数で受けたp/angleはその時点の値で固定される
    function draw(game: Game, p: Vec, size: number, angle: number, alpha: number, color: string) {
        game.drawInWorld((ctx) => {
            ctx.globalAlpha = alpha
            Ctx.polygon(ctx, 3, 1, p, size, color, { theta: angle })
        })
    }
}
