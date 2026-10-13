import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Size } from "../Size"
import { Meteor } from "./Meteor"

export default class extends Stage {
    *G() {
        const sun = new EnemySun(this.game)
        this.game.enemies.push(sun, ...[0, 1, 2, 3].map((i) => new EnemyPlanet(this.game, sun, i)))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemySun extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.06, 2, 3)

    constructor(game: Game) {
        super(game, 2900, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 500).add(this.home())
        yield
    }

    // 彗星を二本ずつ、4回放つ。二本目の遠日点は、一本目の遠日点を太陽を通る縦の線で折り返した所(画面の端の内側に押さえる)。
    // 二本は逆向きに回るので、軌道が交わる
    private *cycle() {
        for (let k = 0; k < 4; k++) {
            const aphelion = vec(
                this.game.WIDTH * (0.08 + 0.84 * this.random()),
                this.game.HEIGHT * (0.72 + 0.22 * this.random()),
            )
            const turn = k % 2 === 0 ? 1 : -1

            yield* Meteor.comet(this, aphelion, turn, "#bfe8ff")
            yield* Meteor.comet(
                this,
                vec(
                    Math.min(Math.max(this.p.x * 2 - aphelion.x, this.game.WIDTH * 0.08), this.game.WIDTH * 0.92),
                    aphelion.y,
                ),
                -turn,
                "#bfe8ff",
            )
            yield* Array(40)
        }

        yield* Array(300)
    }
}

class EnemyPlanet extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 700, Size.S)

        const radius = 90 + 35 * index
        const turn = index % 2 === 0 ? 1 : -1
        this.setParent(parent, () => vec.arg((turn * this.frame) / (60 + 20 * index) + (T * index) / 4).scale(radius))

        if (index % 2 === 0) {
            this.scripts.add(() => this.fan(), { loop: Infinity, margin: 180 + index * 25 })
        } else {
            this.scripts.add(() => this.ring(), { loop: Infinity, margin: 200 + index * 25 })
        }
    }

    private *fan() {
        yield* remodel(this)
            .format("donut")
            .color("#ffe8a0")
            .p(this.p.clone())
            .speed(1)
            .aim(this.game.player)
            .nway(5, T / 22)
            .g((me) => Behavior.ease(me, "speed", 7, 45, Ease.In))
            .fire(this.game.bullets)

        yield* Array(60)
    }

    private *ring() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffd0a0")
            .p(this.p.clone())
            .speed(4)
            .radian(this.random() * T)
            .ex(26)
            .g((me) => Behavior.reaccel(me, 20, 25, 30, 5.5))
            .fire(this.game.bullets)

        yield* Array(80)
    }
}
