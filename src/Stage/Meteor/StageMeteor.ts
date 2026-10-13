import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Part } from "../Part"
import { Meteor } from "./Meteor"
import { Charge } from "../Charge"
import { Size } from "../Size"
import { Bullet } from "../../Game/Actor/Bullet"

// 蛍の光。胴の frame にそろって、150フレームごとに一度光る
namespace Hotaru {
    // 次の拍(胴の frame が150で割り切れるとき)まで待つ。呼んだフレームがちょうど拍でも、次の拍まで待つ
    export function* waitBeat(clock: Enemy) {
        do yield
        while (clock.frame % 150 !== 0)
    }

    // frames フレームの間、拍に合わせて明滅する。
    // 拍から15フレームでだんだん明るくなり、そこから55フレーム光っている間だけ当たる。15フレームで暗くなり、次の拍まで暗いまま。暗い間は当たらない
    export function* blink(b: Bullet, clock: Enemy, frames: number) {
        for (let f = 0; f < frames; f++) {
            const t = clock.frame % 150
            b.type = 15 <= t && t < 70 ? "enemy" : "neutral"
            b.alpha = t < 15 ? 0.15 + t * 0.03 : t < 70 ? 1 : t < 85 ? 1 - (t - 70) * 0.057 : 0.15
            yield
        }
    }

    // e のまわりに光を count 個放つ。光は60フレームかけて速さ speed まで加速し、向きをゆらゆら変えながら漂う。
    // 光は clock の拍に合わせて明滅し、life フレームたつと30フレームかけて消える
    export function* lights(e: Enemy, clock: Enemy, count: number, speed: number, life: number) {
        yield* remodel(e)
            .format("small-ball")
            .r(6)
            .color("#d8ff90")
            .p(e.p.clone())
            .speed(0)
            .radian(e.random() * T)
            .ex(count)
            .forEach((b) => {
                b.p = b.p.add(vec.arg(b.radian).scale(14))
            })
            .g(function* (b) {
                yield* blink(b, clock, life)
                yield* Behavior.fadeout(b, 30)
            })
            .g((b) => Behavior.accel(b, 60, speed))
            .g(function* (b) {
                const base = b.radian
                const phase = this.random() * T

                for (let f = 0; ; f++) {
                    b.radian = base + Math.sin(f / 50 + phase) * 0.8
                    yield
                }
            })
            .fire(e.game.bullets)
    }

    // e のまわりが半径 r でぼうっと光り、frames フレームかけて消える。光は e について動き、当たり判定はない
    export function* glow(e: Enemy, r: number, frames: number) {
        yield* remodel(e)
            .format("big-ball")
            .r(r)
            .type("effect")
            .isScorable(false)
            .color("#d8ff90")
            .alpha(0.2)
            .speed(0)
            .p(e.p.clone())
            .g(function* (b) {
                for (let f = 0; f < frames; f++) {
                    b.p = e.p.clone()
                    b.alpha = 0.2 * (1 - f / frames)
                    yield
                }

                b.life = 0
            })
            .fire(e.game.bullets)
    }
}

export default class extends Stage {
    *G() {
        const boss = new EnemyHotaru(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyHotaru extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.25, this.game.HEIGHT * 0.08, 2, 3)

    private readonly lantern = new Lantern(this.game, this)
    private readonly antennae = [-1, 1].map((side) => new Antenna(this.game, this, side))
    private readonly fireflies = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new Firefly(this.game, this, i))

    readonly parts = [this.lantern, ...this.antennae, ...this.fireflies]

    constructor(game: Game) {
        super(game, 2000, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.phases())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 200).add(this.home())
        yield
    }

    private *phases() {
        this.scripts.add(() => this.ring(), { loop: Infinity, margin: 180, id: "body" })
        while (this.lantern.life > 0) yield

        this.scripts.remove("body")
        yield* Charge.gather(this, 150, "#d8ff90")
        this.scripts.add(() => this.pulse(), { loop: Infinity })

        const bigs = [-165, -55, 55, 165].map((x, i) => {
            const big = new BigFirefly(this.game, this, x, i)
            const grandchildren = [0, 1].map((k) => new LittleFirefly(this.game, big, k))
            big.guardedBy(grandchildren)
            this.game.enemies.push(big, ...grandchildren)
            return big
        })

        this.scripts.add(() => this.meteorFan(), { loop: Infinity, margin: 60, id: "body" })
        while (bigs.some((p) => p.life > 0)) yield

        this.scripts.remove("body")
        this.isInvincible = false
        this.game.camera.shake(8, 30)
        this.scripts.add(() => this.lastLight(), { loop: Infinity, margin: 30, id: "body" })
        this.scripts.add(() => this.swarm(), { loop: Infinity, margin: 30, id: "swarm" })
    }

    // 拍ごとに、胴のまわりがぼうっと光る
    private *pulse() {
        yield* Hotaru.waitBeat(this)
        yield* Hotaru.glow(this, 110, 60)
    }

    private *ring() {
        yield* Hotaru.waitBeat(this)
        yield* Array(15)
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffffc0")
            .p(this.p.clone())
            .speed(3.5)
            .radian(this.random() * T)
            .ex(20)
            .fire(this.game.bullets)
    }

    private *meteorFan() {
        yield* Hotaru.waitBeat(this)
        const sway = (this.random() - 0.5) * 0.6

        for (const k of [0, 1, 2, 3, 4, 5]) {
            this.scripts.add(
                () =>
                    Meteor.fall(this, this.p.clone(), T / 4 + sway + (k - 2.5) * 0.36, {
                        preview: 40,
                        speed: 16,
                        tailInterval: 2,
                        tailLife: 36,
                        color: "#ffffc0",
                    }),
                { margin: k * 6 },
            )
        }
    }

    private *lastLight() {
        yield* Hotaru.waitBeat(this)
        const aim = this.game.player.p.sub(this.p).radian()

        for (const k of [0, -1, 1, -2, 2, -3, 3]) {
            this.scripts.add(
                () =>
                    Meteor.fall(this, this.p.clone(), aim + k * 0.26, {
                        preview: 40,
                        speed: 18,
                        tailInterval: 2,
                        tailLife: 30,
                        color: "#ffffe0",
                    }),
                { margin: Math.abs(k) * 6 },
            )
        }

        yield* Array(60)

        const radian = this.random() * T

        for (const k of [0, 1]) {
            yield* remodel(this)
                .format("diamond")
                .color("#ffffc0")
                .p(this.p.clone())
                .speed(5)
                .radian(radian + (k * T) / 96)
                .ex(48)
                .g((b) => Behavior.reaccel(b, 20, 20, 30, 5.5))
                .fire(this.game.bullets)

            yield* Array(20)
        }
    }

    // 最後の灯。拍ごとに、胴のまわりに光を十放つ。光は子蛍の光より速く(速さ2.6)、長く(450フレーム)漂う
    private *swarm() {
        yield* Hotaru.waitBeat(this)
        yield* Hotaru.lights(this, this, 10, 2.6, 450)
    }
}

class Lantern extends Part {
    constructor(game: Game, parent: Enemy) {
        super(game, parent, 1100, Size.L, 150)
        this.scripts.add(() => this.pulse(), { loop: Infinity })
    }

    // 拍ごとに、発光器のまわりがぼうっと光る
    private *pulse() {
        yield* Hotaru.waitBeat(this.parent)
        yield* Hotaru.glow(this, 110, 60)
    }

    protected place() {
        return vec(0, 80)
    }

    protected *attack() {
        yield* Hotaru.waitBeat(this.parent)
        const aim = this.game.player.p.sub(this.p).radian()

        for (const k of [0, -1, 1, -2, 2]) {
            this.scripts.add(
                () =>
                    Meteor.fall(this, this.p.clone(), aim + k * 0.35, {
                        preview: 45,
                        speed: 16,
                        tailInterval: 2,
                        tailLife: 36,
                        color: "#d8ff90",
                    }),
                { margin: Math.abs(k) * 8 },
            )
        }
    }
}

class Antenna extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 450, Size.M, 130 + (side > 0 ? 30 : 0))
    }

    protected place() {
        return vec(this.side * 100, 0)
    }

    protected *attack() {
        yield* remodel(this)
            .format("line")
            .color("#f0ffc0")
            .p(this.p.clone())
            .speed(2)
            .aim(this.game.player)
            .duplicate(7)
            .delayByIndex(4)
            .g((b) => Behavior.ease(b, "speed", 8, 30, Ease.In))
            .fire(this.game.bullets)

        yield* Array(50)
    }
}

class Firefly extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly i: number,
    ) {
        super(game, parent, 250, Size.S, 160)
    }

    protected place() {
        return vec.arg(this.frame / 120 + (T * this.i) / 8).scale(160)
    }

    // 拍から i * 6 フレーム遅れて光り、まわりに光を六つ放つ。光は60フレームかけて速さ2.2まで加速し、向きをゆらゆら変えながら漂う。
    // 光は拍に合わせて明滅し、420フレームたつと30フレームかけて消える
    protected *attack() {
        yield* Hotaru.waitBeat(this.parent)
        yield* Array(this.i * 6)
        yield* Hotaru.glow(this, 50, 40)
        yield* Hotaru.lights(this, this.parent, 6, 2.2, 420)
    }
}

class BigFirefly extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly x: number,
        private readonly i: number,
    ) {
        super(game, parent, 350, Size.M, 60 + i * 20)
    }

    protected place() {
        return vec(this.x, 200)
    }

    // 一拍おきに(隣の大蛍とは交互に)、拍から15フレームたつと、左から右へ光を一つずつ灯して横一列の帯を作る。帯は少しして雨のように降る
    protected *attack() {
        yield* Hotaru.waitBeat(this.parent)
        if (Math.floor(this.parent.frame / 150) % 2 === this.i % 2) return
        yield* Array(15)

        for (let f = 0; f < 60; f += 4) {
            yield* remodel(this)
                .format("small-ball")
                .r(5)
                .color("#e8ffb0")
                .p(this.p.add(vec(-42 + f * 1.4, 0)))
                .speed(0)
                .radian(T / 4)
                .appear(10)
                .g(function* (b) {
                    yield* Array(80 - f)
                    yield* Behavior.accel(b, 30, 4.5)
                })
                .fire(this.game.bullets)
            yield* Array(4)
        }
    }
}

class LittleFirefly extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly k: number,
    ) {
        super(game, parent, 110, Size.S, 70 + k * 50)
    }

    protected place() {
        return vec.arg(this.frame / 30 + this.k * Math.PI).scale(56)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .r(4)
            .color("#f0ffd0")
            .p(this.p.clone())
            .speed(3)
            .radian(this.random() * T)
            .ex(6)
            .fire(this.game.bullets)

        yield* Array(120)
    }
}
