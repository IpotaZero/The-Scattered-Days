import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Motion } from "../../Game/Actor/Motion"
import { Shape } from "../../Game/Actor/Shape"
import { Ease, GenUtils } from "@ipota/functions"
import { T } from "../../T"

// 流星道場の「流れ星」。
// 流れ星は、まず通り道に薄い予告線(当たり判定なし)が引かれ、そのあと画面の端から端まで一気に駆け抜ける。
// 駆け抜けた後には尾(止まった小さな弾)が残り、しばらくしてから消える。尾の弾は詰まっていて抜けられない
export namespace Meteor {
    export type Config = {
        // 予告線を引いてから流れ星が飛び出すまで(提示)
        preview: number
        speed: number
        // 尾の弾を落とす間隔と、尾が残っている時間
        tailInterval: number
        tailLife: number
        color: Color
    }

    // 点 through を通って向き angle に進む直線が、画面に入る点と出る点。画面にかからなければ undefined
    export function crossing(game: Game, through: Vec, angle: number): [Vec, Vec] | undefined {
        const d = vec.arg(angle)
        let enter = -Infinity
        let exit = Infinity

        for (const [p, v, size] of [
            [through.x, d.x, game.WIDTH],
            [through.y, d.y, game.HEIGHT],
        ]) {
            if (Math.abs(v) < 1e-9) {
                if (p < 0 || size < p) return undefined
                continue
            }

            const t0 = (0 - p) / v
            const t1 = (size - p) / v
            enter = Math.max(enter, Math.min(t0, t1))
            exit = Math.min(exit, Math.max(t0, t1))
        }

        if (enter >= exit) return undefined

        // 端ちょうどだとBulletのboundaryで消えることがあるので、少し内側にする
        return [through.add(d.scale(enter + 1)), through.add(d.scale(exit - 1))]
    }

    // 点 through を通って向き angle に、予告線を引いてから流れ星を流す
    export function* fall(e: Enemy, through: Vec, angle: number, config: Config) {
        const ends = crossing(e.game, through, angle)
        if (!ends) return

        const [start, end] = ends
        const game = e.game

        yield* remodel(e)
            .shape(Shape.laser)
            .type("neutral")
            .isScorable(false)
            .color(config.color)
            .r(2)
            .motion(Motion.still)
            .p(start)
            .radian(angle)
            .length(end.sub(start).magnitude())
            .alpha(0)
            .g(function* (me) {
                yield* Behavior.ease(me, "alpha", 0.15, 15)
                yield* Array(config.preview - 15)
                yield* Behavior.fadeout(me, 10)
            })
            .fire(game.bullets)

        yield* Array(config.preview)
        if (e.life <= 0) return

        yield* remodel(e)
            .format("big-ball")
            .r(16)
            .color(config.color)
            .p(start)
            .radian(angle)
            .speed(config.speed)
            .g(function* (me) {
                for (let f = 0; me.life > 0; f++) {
                    if (f % config.tailInterval === 0) {
                        yield* remodel(this)
                            .format("small-ball")
                            .r(5)
                            .color(config.color)
                            .p(me.p.clone())
                            .speed(0)
                            .g(function* (tail) {
                                yield* Array(config.tailLife)
                                yield* Behavior.fadeout(tail, 20)
                            })
                            .fire(game.bullets)
                    }

                    yield
                }
            })
            .fire(game.bullets)
    }

    // 流星群。画面を、向き angle に平行で spacing ずつ離れた筋に分け(筋の位置は spacing の範囲でずらす)、割合 density の筋にだけ流れ星を流す(fall)。
    // 筋ごとに、6フレームの0倍から(筋の数-1)倍のどれかだけ遅らせて流す
    export function* shower(e: Enemy, angle: number, spacing: number, density: number, config: Config) {
        const center = vec(e.game.WIDTH / 2, e.game.HEIGHT / 2)
        const normal = vec.arg(angle + T / 4)
        const reach = (e.game.WIDTH + e.game.HEIGHT) / 2
        const offset = e.random() * spacing

        const lanes = Array.from({ length: Math.ceil((reach * 2) / spacing) }, (_, k) =>
            center.add(normal.scale(-reach + offset + k * spacing)),
        ).filter(() => e.random() < density)

        yield* GenUtils.all(
            Object.fromEntries(
                lanes.map((through, k) => [
                    `lane${k}`,
                    (function* () {
                        yield* Array(Math.floor(e.random() * lanes.length) * 6)
                        yield* fall(e, through, angle, config)
                    })(),
                ]),
            ),
        )
    }

    // 彗星。e のいる所を太陽として、遠日点 aphelion まで行って戻る楕円の軌道を、240フレームかけて一周する。
    // 太陽から70の所(近日点)で生まれ、turn の向き(1か-1)に回る。2フレームごとに尾(止まった小さな弾)を落とし、尾は36フレーム残って16フレームで消える
    export function* comet(e: Enemy, aphelion: Vec, turn: number, color: Color) {
        const sun = e.p.clone()

        yield* remodel(e)
            .format("big-ball")
            .r(14)
            .color(color)
            .speed(0)
            .unbounded()
            .g(function* (me) {
                const far = aphelion.sub(sun).magnitude()
                const away = sun.sub(aphelion).normalize()
                const a = (far + 70) / 2

                const gm = (4 * Math.PI ** 2 * a ** 3) / 240 ** 2

                me.p = sun.add(away.scale(70))
                let v = vec.arg(away.radian() + (turn * T) / 4).scale(Math.sqrt(gm * (2 / 70 - 1 / a)))

                yield* Behavior.appear(me, 10)

                for (let f = 0; f < 240; f++) {
                    for (let s = 0; s < 8; s++) {
                        const d = sun.sub(me.p)
                        const r = Math.max(d.magnitude(), 20)
                        v = v.add(d.scale(gm / r ** 3 / 8))
                        me.p = me.p.add(v.scale(1 / 8))
                    }

                    me.radian = v.radian()

                    if (f % 2 === 0) {
                        yield* remodel(this)
                            .format("small-ball")
                            .r(5)
                            .color(color)
                            .p(me.p.clone())
                            .speed(0)
                            .g(function* (tail) {
                                yield* Array(36)
                                yield* Behavior.fadeout(tail, 16)
                            })
                            .fire(this.game.bullets)
                    }

                    yield
                }

                yield* Behavior.fadeout(me, 15)
            })
            .fire(e.game.bullets)
    }

    // 星座の線。a と b の間に、50フレームかけて薄い線(当たらない)が濃くなっていく。線は弾 count 発に砕け、center から遠ざかる向きへ飛び、
    // 60フレームかけて速さ speed まで加速する。線を引いている間に a か b が倒れると、線は消えて砕けない。弾は e が撃つ
    export function* link(e: Enemy, a: Enemy, b: Enemy, center: Enemy, count: number, speed: number, color: Color) {
        yield* remodel(e)
            .shape(Shape.laser)
            .type("neutral")
            .isScorable(false)
            .color(color)
            .r(2)
            .motion(Motion.still)
            .alpha(0)
            .g(function* (line) {
                for (let f = 0; f < 50 && a.life > 0 && b.life > 0; f++) {
                    line.p = a.p.clone()
                    line.radian = b.p.sub(a.p).radian()
                    line.length = b.p.sub(a.p).magnitude()
                    line.alpha = (0.4 * f) / 50
                    yield
                }

                line.life = 0
            })
            .fire(e.game.bullets)

        yield* Array(50)

        if (a.life <= 0 || b.life <= 0) return

        const along = b.p.sub(a.p)
        const away = a.p.add(along.scale(0.5)).sub(center.p).radian()
        const normal = along.radian() + T / 4

        yield* remodel(e)
            .format("small-ball")
            .r(5)
            .color(color)
            .speed(0.5)
            .radian(Math.cos(normal - away) > 0 ? normal : normal + Math.PI)
            .duplicate(count, (shard, k) => {
                shard.p = a.p.add(along.scale((k + 0.5) / count))
                return shard
            })
            .g((shard) => Behavior.ease(shard, "speed", speed, 60, Ease.In))
            .fire(e.game.bullets)
    }
}
