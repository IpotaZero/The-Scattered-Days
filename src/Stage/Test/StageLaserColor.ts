import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/Enemy/EnemyRendererCore"
import { Size } from "../Size"

export default class extends Stage {
    *G() {
        yield* this.game.textBox.say(["レーザーとビームの色の確認用ステージ。<br>被弾はしない。<br>的を倒すと終了。"])

        this.game.enemies.push(new EnemyTarget(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

// 画面の下寄りに止まり、下向きに扇形のビーム7本を出し続け、横向きのレーザー13本を予告から消えるまで繰り返し出す。
// どの弾も毎フレーム neutral に戻すので被弾しない
class EnemyTarget extends Enemy {
    constructor(game: Game) {
        super(game, 3000, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.p = vec(game.WIDTH / 2, game.HEIGHT * 0.7)
        this.scripts.add(() => this.beams())
        this.scripts.add(() => this.lasers(), { loop: Infinity })
    }

    // 色相 0, 60, ..., 300 と白のビームを、30° から 150° の向きへ 20° おきに並べる
    private *beams() {
        for (const [i, color] of ([0, 60, 120, 180, 240, 300].map((h) => `hsl(${h},100%,50%)`) as Color[])
            .concat(["white"])
            .entries()) {
            yield* remodel(this)
                .beam(this.game.HEIGHT)
                .color(color)
                .radian((Math.PI / 180) * (30 + 20 * i))
                .g(function* (me) {
                    while (me.life > 0) {
                        me.type = "neutral"
                        yield
                    }
                })
                .fire(this.game.bullets)
        }
    }

    // 色相 0, 30, ..., 330 と白のレーザーを、画面の高さの 0.15 から 0.6 の位置へ横向きに並べる。
    // レーザーは60フレーム予告し、180フレーム出て、15フレームかけて消える。出してから360フレーム後に次を出す
    private *lasers() {
        for (const [i, color] of (
            [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((h) => `hsl(${h},100%,50%)`) as Color[]
        )
            .concat(["white"])
            .entries()) {
            yield* remodel(this)
                .laser(
                    60,
                    180,
                    vec(this.game.WIDTH * 0.05, this.game.HEIGHT * (0.15 + (0.45 * i) / 12)),
                    vec(this.game.WIDTH * 0.95, this.game.HEIGHT * (0.15 + (0.45 * i) / 12)),
                )
                .color(color)
                .g(function* (me) {
                    while (me.life > 0) {
                        me.type = "neutral"
                        yield
                    }
                })
                .fire(this.game.bullets)
        }

        yield* Array(360)
    }
}
