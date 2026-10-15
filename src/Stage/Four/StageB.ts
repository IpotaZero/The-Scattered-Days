import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Motion } from "../../Game/Actor/Bullet/Motion"
import { Stage } from "../Stage"
import { T } from "../../T"
import { EnemyRendererBoss } from "../../Game/Actor/Enemy/EnemyRendererBoss"
import { Part } from "../Part"
import { Charge } from "../Charge"
import { Size } from "../Size"

export default class extends Stage {
    *G() {
        const boss = new EnemyBoss(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyBoss extends Enemy {
    private readonly paws = [-1, 1].map((side) => new Paw(this.game, this, side))
    private readonly hindLegs = [-1, 1].map((side) => new HindLeg(this.game, this, side))
    private readonly tail = new Tail(this.game, this)
    private readonly cubs = [0, 1, 2].map((k) => new Cub(this.game, this, k))

    private readonly guards = [...this.paws, this.tail]
    readonly parts = [...this.paws, ...this.hindLegs, this.tail, ...this.cubs]

    constructor(game: Game) {
        super(game, 1600, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.phases())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.16), 120)

        this.scripts.add(() => this.pounce(), { loop: Infinity, id: "move" })
    }

    private *phases() {
        this.scripts.add(() => this.ring(), { loop: Infinity, margin: 180, id: "body" })
        while (this.guards.some((p) => p.life > 0)) yield

        this.scripts.remove("body")
        this.scripts.remove("move")
        yield* Charge.gather(this, 150, "#f0f0ff")
        this.scripts.add(() => this.pounce(), { loop: Infinity, id: "move" })

        const youngs = [-1, 1].map((side) => {
            const young = new Young(this.game, this, side)
            const claw = new YoungClaw(this.game, young, side)
            young.guardedBy([claw])
            this.game.enemies.push(young, claw)
            return young
        })

        this.scripts.add(() => this.roar(), { loop: Infinity, margin: 90, id: "body" })
        while (youngs.some((p) => p.life > 0)) yield

        this.scripts.remove("body")
        this.scripts.remove("move")
        yield* Charge.gather(this, 120, "#ff7070")
        this.isInvincible = false
        this.scripts.add(() => this.gale(), { loop: Infinity, id: "move" })
        this.scripts.add(() => Tiger.claw(this), { loop: Infinity, margin: 30, id: "claw" })
        this.scripts.add(() => Tiger.stripes(this), { loop: Infinity, margin: 90, id: "stripes" })
        this.scripts.add(() => this.roar(), { loop: Infinity, margin: 60, id: "body" })
    }

    private *pounce() {
        yield* Array(55)
        yield* this.moveTo(
            vec(this.game.WIDTH * (0.32 + 0.36 * this.random()), this.game.HEIGHT * (0.1 + 0.12 * this.random())),
            60,
        )
    }

    private *gale() {
        yield* Array(20)
        yield* this.moveTo(
            vec(this.game.WIDTH * (0.32 + 0.36 * this.random()), this.game.HEIGHT * (0.1 + 0.14 * this.random())),
            60,
        )

        yield* remodel(this)
            .format("diamond")
            .color("#ffffff")
            .p(this.p.clone())
            .speed(1.6)
            .radian(this.random() * T)
            .ex(40)
            .g((b) => Behavior.ease(b, "speed", 5.2, 30, Ease.In))
            .fire(this.game.bullets)
    }

    private *ring() {
        yield* remodel(this)
            .format("small-ball")
            .color("#ffffff")
            .p(this.p.clone())
            .speed(2.8)
            .radian(this.random() * T)
            .ex(24)
            .fire(this.game.bullets)

        yield* Array(120)
    }

    private *roar() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffffff")
            .p(this.p.clone())
            .radian(this.random() * T)
            .ex(28)
            .duplicate(3, (b, k) => {
                b.radian += (k * T) / 84
                b.speed = 2.8 + k * 0.8
                return b
            })
            .fire(this.game.bullets)

        yield* Array(80)
    }
}

namespace Tiger {
    export function* claw(me: Enemy) {
        const start = me.p.clone()
        const aim = me.game.player.p.sub(start).radian()

        yield* remodel(me)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color("#ffffff")
            .r(2)
            .motion(Motion.still)
            .p(start)
            .radian(aim)
            .length(me.game.WIDTH + me.game.HEIGHT)
            .alpha(0)
            .shift(4, 22)
            // 予告線は濃さ0.3まで8フレームで現れ、爪が飛び終わるまで(75フレーム目まで)残って、15フレームで消える
            .g(function* (b) {
                yield* Behavior.ease(b, "alpha", 0.3, 8)
                yield* Array(67)
                yield* Behavior.fadeout(b, 15)
            })
            .fire(me.game.bullets)

        yield* Array(60)

        yield* remodel(me)
            .format("line")
            .color("#ffffff")
            .p(start)
            .radian(aim)
            .speed(19.2)
            .duplicate(6)
            .delayByIndex(3)
            .shift(4, 22)
            .fire(me.game.bullets)

        yield* Array(90)
    }

    export function* stripes(me: Enemy) {
        const sway = (me.random() - 0.5) * 0.6

        for (let k = 0; k < 5; k++) {
            yield* remodel(me)
                .format("small-ball")
                .color("#f0f0f0")
                .p(me.p.clone())
                .speed(4.4)
                .radian(T / 4 + sway + (k - 2) * 0.12)
                .shift(11, 24)
                .fire(me.game.bullets)
            yield* Array(60)
        }

        yield* Array(140)
    }
}

class Paw extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        // 右の前脚は420フレーム充電してから動き出す
        super(game, parent, 1000, Size.L, 140 + (side > 0 ? 55 : 0), { charge: side > 0 ? 420 : 0 })
    }

    protected place() {
        return vec.arg(T / 4 - (this.side * T) / 10).scale(100)
    }

    protected *attack() {
        yield* Tiger.claw(this)
    }
}

class HindLeg extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        // 後脚は左が1200フレーム、右が1500フレーム充電してから動き出す
        super(game, parent, 700, Size.M, 170 + (side > 0 ? 45 : 0), { charge: side > 0 ? 1500 : 1200 })
    }

    protected place() {
        return vec.arg(-T / 4 + (this.side * T) / 5).scale(100)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .color("#d0e8ff")
            .p(this.p.clone())
            .speed(5.2)
            .radian(this.side > 0 ? 0 : Math.PI)
            .duplicate(8)
            .delayByIndex(4)
            .nway(3, 0.22)
            .unbounded()
            .g(function* (b) {
                yield* Behavior.rotating(b, this.side * 0.036, 44)

                while (b.p.y < b.game.HEIGHT + 20) yield
                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(120)
    }
}

class Tail extends Part {
    constructor(game: Game, parent: Enemy) {
        // 900フレーム充電してから動き出す
        super(game, parent, 1200, Size.L, 200, { charge: 900 })
    }

    protected place() {
        return vec(0, -100)
    }

    protected *attack() {
        yield* Tiger.stripes(this)
    }
}

class Cub extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly k: number,
    ) {
        // 600・840・1080フレーム充電してから、順に動き出す
        super(game, parent, 360, Size.S, 150 + k * 30, { charge: 600 + k * 240 })
    }

    protected place() {
        return vec((this.k - 1) * 60, 160)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .color("#fff0d0")
            .p(this.p.clone())
            .speed(1.2)
            .radian(this.random() * T)
            .ex(12)
            .g((b) => Behavior.ease(b, "speed", 4.4, 40, Ease.In))
            .fire(this.game.bullets)

        yield* Array(75)
    }
}

class Young extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        // 右の若虎は480フレーム充電してから動き出す
        super(game, parent, 700, Size.M, 60 + (side > 0 ? 50 : 0), { charge: side > 0 ? 480 : 0 })
    }

    protected place() {
        return vec(this.side * 115, 60)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .color("#f0f0ff")
            .p(this.p.clone())
            .speed(3.2)
            .radian(this.random() * T)
            .ex(20)
            .g((b) => Behavior.reaccel(b, 20, 20, 30, 4.4))
            .fire(this.game.bullets)

        yield* Array(90)
    }
}

class YoungClaw extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        // 右の若虎の爪は480フレーム充電してから動き出す(充電中は攻撃が効かないので、その間は右の若虎も守られたまま)
        super(game, parent, 200, Size.S, 80, { charge: side > 0 ? 480 : 0 })
    }

    protected place() {
        return vec.arg(this.frame / 50 + (this.side > 0 ? 0 : Math.PI)).scale(60)
    }

    protected *attack() {
        yield* remodel(this)
            .format("line")
            .color("#ffffff")
            .p(this.p.clone())
            .speed(2.4)
            .radian(T / 4)
            .duplicate(5)
            .delayByIndex(3)
            .shift(3, 16)
            .g((b) => Behavior.ease(b, "speed", 7.2, 30, Ease.In))
            .fire(this.game.bullets)

        yield* Array(70)
    }
}
