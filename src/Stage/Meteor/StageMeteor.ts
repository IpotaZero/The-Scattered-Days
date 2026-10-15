import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/Enemy/EnemyRendererBoss"
import { Part } from "../Part"
import { Meteor } from "./Meteor"
import { Charge } from "../Charge"
import { Size } from "../Size"
import { Bullet } from "../../Game/Actor/Bullet/Bullet"

// 蛍の光。胴の frame にそろって、150フレームごとに一度光る
namespace Hotaru {
    // 次の拍(胴の frame が150で割り切れるとき)まで待つ。呼んだフレームがちょうど拍でも、次の拍まで待つ
    export function* waitBeat(clock: Enemy) {
        do yield
        while (clock.frame % 150 !== 0)
    }

    // frames フレームの間、拍に合わせて明滅する。
    // 拍から25フレームで濃さ0.3から0.7まで明るくなり(当たらない)、そこから45フレーム光っている間だけ当たる。
    // 15フレームで暗くなり、次の拍まで濃さ0.3で見えたまま(当たらない)
    export function* blink(b: Bullet, clock: Enemy, frames: number) {
        for (let f = 0; f < frames; f++) {
            const t = clock.frame % 150
            b.type = 25 <= t && t < 70 ? "enemy" : "neutral"
            b.alpha = t < 25 ? 0.3 + t * 0.016 : t < 70 ? 1 : t < 85 ? 1 - (t - 70) * 0.047 : 0.3
            yield
        }
    }

    // e のまわりに光を count 個放つ。光は clock の拍に合わせて明滅し(blink)、光っている45フレームの間だけ、速さ0から speed まで上がってまた0に戻るように飛ぶ。
    // 暗い間はその場に止まっている。飛ぶ向きは、放たれた向きを中心に少しずつ揺れる。life フレームたつと30フレームかけて消える
    export function* lights(e: Enemy, clock: Enemy, count: number, speed: number, life: number) {
        yield* remodel(e)
            .format("small-ball")
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
            .g(function* (b) {
                const base = b.radian
                const phase = this.random() * T

                for (let f = 0; ; f++) {
                    const t = clock.frame % 150
                    b.speed = 25 <= t && t < 70 ? speed * Math.sin((Math.PI * (t - 25)) / 45) : 0
                    b.radian = base + Math.sin(f / 50 + phase) * 0.5
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
        this.scripts.add(() => this.necklace(), { loop: Infinity, margin: 180, id: "body" })
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
        this.scripts.add(() => this.comets(), { loop: Infinity, margin: 60, id: "comets" })
        while (bigs.some((p) => p.life > 0)) yield

        this.scripts.remove("body")
        this.scripts.remove("comets")
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

    // 一拍おきに、拍から15フレームたつと、隣り合う子蛍どうしを星座の線で結ぶ。線は弾10発に砕け、胴から遠ざかる向きへ飛んで速さ3.5まで加速する(Meteor.link)。
    // 倒れた子蛍とは結ばないので、子蛍を落とすほど輪が切れていく
    private *necklace() {
        yield* Hotaru.waitBeat(this)
        if (Math.floor(this.frame / 150) % 2 === 1) return
        yield* Array(15)

        this.fireflies.forEach((a, k) => {
            this.scripts.add(() =>
                Meteor.link(this, a, this.fireflies[(k + 1) % this.fireflies.length], this, 10, 3.5, "#ffffc0"),
            )
        })
    }

    // 一拍おきに、彗星を二本放つ(Meteor.comet)。二本目の遠日点は、一本目の遠日点を胴を通る縦の線で折り返した所(画面の端の内側に押さえる)。
    // 二本は逆向きに回るので、軌道が交わる
    private *comets() {
        yield* Hotaru.waitBeat(this)
        if (Math.floor(this.frame / 150) % 2 === 0) return

        const aphelion = vec(
            this.game.WIDTH * (0.08 + 0.84 * this.random()),
            this.game.HEIGHT * (0.72 + 0.22 * this.random()),
        )
        const turn = this.random() < 0.5 ? 1 : -1

        yield* Meteor.comet(this, aphelion, turn, "#ffffc0")
        yield* Meteor.comet(
            this,
            vec(
                Math.min(Math.max(this.p.x * 2 - aphelion.x, this.game.WIDTH * 0.08), this.game.WIDTH * 0.92),
                aphelion.y,
            ),
            -turn,
            "#ffffc0",
        )
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

    // 最後の灯。拍ごとに、画面全体に流星群を降らせる(Meteor.shower)。流星群は拍ごとに左右逆の斜めから降るので、前の拍の尾と交わって格子になる。
    // 一拍おきに、流星群に加えて自機を狙う流れ星を3本流す。拍から60フレームたつと、菱形の輪を二重に広げる
    private *lastLight() {
        yield* Hotaru.waitBeat(this)

        const side = Math.floor(this.frame / 150) % 2 === 0 ? 1 : -1

        this.scripts.add(() =>
            Meteor.shower(this, T / 4 + side * (T / 14 + (this.random() * T) / 14), 75, 0.6, {
                preview: 50,
                speed: 12,
                tailInterval: 2,
                tailLife: 40,
                color: "#ffffe0",
            }),
        )

        if (side < 0) {
            const aim = this.game.player.p.sub(this.p).radian()

            for (const k of [0, -1, 1]) {
                this.scripts.add(
                    () =>
                        Meteor.fall(this, this.p.clone(), aim + k * 0.3, {
                            preview: 40,
                            speed: 18,
                            tailInterval: 2,
                            tailLife: 30,
                            color: "#ffffe0",
                        }),
                    { margin: Math.abs(k) * 6 },
                )
            }
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

    // 最後の灯。拍ごとに、胴のまわりに光を十放つ(Hotaru.lights)。光は子蛍の光より速く(光っている間の速さは最大4)、長く(450フレーム)漂う
    private *swarm() {
        yield* Hotaru.waitBeat(this)
        yield* Hotaru.lights(this, this, 10, 4, 450)
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
                        color: "#fff4b0",
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

    // 拍から i * 6 フレーム遅れて光り、まわりに光を六つ放つ(Hotaru.lights)。光は拍に合わせて明滅し、光っている間だけ最大で速さ3.5で飛ぶ。
    // 420フレームたつと30フレームかけて消える
    protected *attack() {
        yield* Hotaru.waitBeat(this.parent)
        yield* Array(this.i * 6)
        yield* Hotaru.glow(this, 50, 40)
        yield* Hotaru.lights(this, this.parent, 6, 3.5, 420)
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
            .color("#f0ffd0")
            .p(this.p.clone())
            .speed(3)
            .radian(this.random() * T)
            .ex(6)
            .fire(this.game.bullets)

        yield* Array(120)
    }
}
