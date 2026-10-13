import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Size } from "../Size"
import { T } from "../../T"

export default class extends Stage {
    *G() {
        yield* this.game.textBox.say(["lineとarrowの色の確認用ステージ。<br>被弾はしない。<br>的を倒すと終了。"])

        this.game.enemies.push(new EnemyTarget(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

// 画面の上に止まり、左の口から line、右の口から arrow を、4フレームごとに4発ずつ下向きに出し続ける。
// 色相は1フレームに2°ずつ回る。弾は毎フレーム少しずつ曲がり(左は時計回り、右は反時計回り)、毎フレーム neutral に戻るので被弾しない
class EnemyTarget extends Enemy {
    constructor(game: Game) {
        super(game, 3000, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.p = vec(game.WIDTH / 2, game.HEIGHT * 0.12)
        this.scripts.add(() => this.stream("line", -1), { loop: Infinity })
        this.scripts.add(() => this.stream("arrow", 1), { loop: Infinity })
    }

    // side が -1 なら左の口、1 なら右の口から出す。曲がる向きは side と逆
    private *stream(format: "line" | "arrow", side: number) {
        yield* remodel(this)
            .format(format)
            .p(this.p.add(vec(this.game.WIDTH * 0.2 * side, 0)))
            .radian(T / 4)
            .speed(4)
            .color(`hsl(${(this.frame * 2) % 360},100%,50%)`)
            .nway(4, T / 48)
            .g(function* (me) {
                while (me.life > 0) {
                    me.type = "neutral"
                    me.radian -= 0.003 * side
                    yield
                }
            })
            .fire(this.game.bullets)

        yield* Array(30)
    }
}
