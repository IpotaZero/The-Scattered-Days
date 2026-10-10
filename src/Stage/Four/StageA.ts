import { vec, Vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Charge } from "../Charge"
import { Size } from "../Size"

// 頭のまわりを、三つの子頭がそれぞれ違う半径・向き・速さで回る。
// 子頭は動いた跡に幽霊の体(進む向きを横切る光の線)を残す。光の線は速く動いているほど長く、10フレームかけて現れてからしばらく残り、消える。
// 三本の幽霊の体が、頭のまわりで絡み合いながら流れる。
// 子頭は撃たれている間だけ回る速さが四分の一まで落ち、幽霊の体も短くなる。撃たれなくなると元の速さに戻る。
// 子頭の体力は350・500・650。三つとも落とすまで頭に攻撃は効かない。頭はときどき遅い輪を放つ。
// 子頭をすべて落とすと、頭は力を溜めてから攻撃が効くようになり、画面を大きく速く動いて、自分も長い幽霊の体を引く。

export default class extends Stage {
    *G() {
        const boss = new EnemyBoss(this.game)
        this.game.enemies.push(boss, ...boss.heads)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

namespace Ghost {
    // e のいる所に、velocity の向きを横切る光の線を一本残す。線の長さは速さで決まる。
    // 線は10フレームかけて現れ(その間は当たらない)、life フレーム残ってから20フレームかけて消える
    export function* rib(e: Enemy, velocity: Vec, life: number, color: Color) {
        if (velocity.magnitude() < 0.5) return

        const across = velocity.radian() + T / 4
        const half = 24 + Math.min(velocity.magnitude() * 14, 90)

        yield* remodel(e)
            .appearance("beam")
            .collision("rect")
            .isScorable(false)
            .color(color)
            .r(4)
            .speed(0)
            .radian(across)
            .length(half * 2)
            .p(e.p.sub(vec.arg(across).scale(half)))
            .appear(10)
            .g(function* (b) {
                yield* Array(life)
                yield* Behavior.fadeout(b, 20)
            })
            .fire(e.game.bullets)
    }
}

class EnemyBoss extends Enemy {
    readonly heads: SubHead[]

    constructor(game: Game) {
        super(game, 1500, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true
        this.p = vec(this.game.WIDTH / 2, -200)

        this.heads = [
            new SubHead(game, this, 350, 100, 0.022, 0, "#d0ffa0"),
            new SubHead(game, this, 500, 150, -0.016, T / 3, "#a0ffd0"),
            new SubHead(game, this, 650, 200, 0.012, (T * 2) / 3, "#e0ffc0"),
        ]

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.phases())
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.33)
    }

    private *enter() {
        yield* this.moveTo(this.home(), 150)
        this.scripts.add(() => this.drift(), { id: "move" })
        this.scripts.add(() => this.ring(14, 2.5, 150), { loop: Infinity, margin: 60, id: "ring" })
    }

    // 画面の中ほどを、ゆっくり大きく漂う
    private *drift() {
        const path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.2, 2, 3)

        for (let f = 0; ; f++) {
            this.p = path(f / 360).add(this.home())
            yield
        }
    }

    // 画面を大きく速くうねる
    private *rampage() {
        const path = Curves.lissajous(this.game.WIDTH * 0.7, this.game.HEIGHT * 0.4, 3, 2)

        for (let f = 0; ; f++) {
            this.p = path(f / 160).add(this.home())
            yield
        }
    }

    private *phases() {
        while (this.heads.some((p) => p.life > 0)) yield

        // 子頭をすべて落とすと、力を溜めてから攻撃が効くようになり、大きく速くうねって、自分も幽霊の体を引く
        this.scripts.remove("move")
        this.scripts.remove("ring")
        yield* this.moveTo(this.home(), 60)
        yield* Charge.gather(this, 120, "#d0ffa0")
        this.isInvincible = false
        this.scripts.add(() => this.rampage(), { id: "move" })
        this.scripts.add(() => this.trail(), { loop: Infinity, id: "trail" })
        this.scripts.add(() => this.ring(20, 3, 110), { loop: Infinity, margin: 60, id: "ring" })
    }

    // 3フレームごとに、動いた向きを横切る光の線を残す。線は90フレーム残る
    private *trail() {
        const before = this.p.clone()
        yield* Array(3)
        yield* Ghost.rib(this, this.p.sub(before).scale(1 / 3), 90, "#d0ffa0")
    }

    // count 個の弾の輪を speed の速さで放ち、interval フレーム待つ
    private *ring(count: number, speed: number, interval: number) {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#e0ffc0")
            .p(this.p.clone())
            .speed(speed)
            .radian(this.random() * T)
            .ex(count)
            .fire(this.game.bullets)

        yield* Array(interval)
    }
}

// 子頭。頭のまわりの、縦の半径 radius・横の半径 radius の0.85倍の楕円を、1フレームに turn ずつ回る。現れてから60フレームかけて、頭の中心から円の上まで広がる。
// 撃たれている間は回る速さが四分の一まで落ち、撃たれなくなると少しずつ元の速さに戻る。
// 3フレームごとに、動いた向きを横切る光の線(幽霊の体)を残す。線は70フレーム残る
class SubHead extends Enemy {
    constructor(
        game: Game,
        head: Enemy,
        life: number,
        radius: number,
        turn: number,
        phase: number,
        private readonly color: Color,
    ) {
        super(game, life, Size.M)
        this.p = head.p.clone()

        this.scripts.add(() => this.orbit(head, radius, turn, phase))
        this.scripts.add(() => this.trail(), { loop: Infinity, margin: 120 })
    }

    private *orbit(head: Enemy, radius: number, turn: number, phase: number) {
        let angle = phase
        let pace = 1

        for (let f = 0; head.life > 0; f++) {
            pace += ((this.damaged ? 0.25 : 1) - pace) * 0.1
            angle += turn * pace
            this.p = head.p.add(
                vec(Math.cos(angle) * 0.85, Math.sin(angle)).scale(radius * Ease.Out(Math.min(1, f / 60))),
            )
            yield
        }

        this.life = 0
    }

    private *trail() {
        const before = this.p.clone()
        yield* Array(3)
        yield* Ghost.rib(this, this.p.sub(before).scale(1 / 3), 70, this.color)
    }
}
