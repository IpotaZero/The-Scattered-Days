import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Phase } from "./Phase"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const RINGS = 11
const RING_INTERVAL = 26

const CYCLE_FRAMES = RINGS * RING_INTERVAL + 200
const RING: Phase.Ring = { count: 44, speed: 3.4, color: "#fff2c0" }

const STAR_LIFE = 850

export default class extends Stage {
    *G() {
        const moon = new EnemyMoon(this.game)
        this.game.enemies.push(moon, new EnemyStar(this.game, moon, -1), new EnemyStar(this.game, moon, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMoon extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        super(game, STAR_LIFE * 2, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    // 照らされる向きは、最初の輪では自機のいる向き。そこから輪ごとに30°ずつ回る
    private *cycle() {
        const light = this.game.player.p.sub(this.p).radian()
        const turn = this.random() < 0.5 ? -1 : 1

        for (let k = 0; k < RINGS; k++) {
            const lit = Math.sin((Math.PI * (k + 1)) / (RINGS + 1))

            yield* Phase.ring(this, RING, light + (turn * k * T) / 12, lit).fire(this.game.bullets)
            yield* Array(RING_INTERVAL)
        }

        yield* Array(CYCLE_FRAMES - RINGS * RING_INTERVAL)
    }
}

class EnemyStar extends Enemy {
    constructor(game: Game, parent: Enemy, side: number) {
        super(game, STAR_LIFE, Size.S)

        this.setParent(parent, () => vec(side * game.WIDTH * 0.32, game.HEIGHT * 0.05 * Math.sin(this.frame / 110)))

        this.scripts.add(() => this.cycle(), { margin: ENTRANCE_FRAMES + 90 + (side > 0 ? 55 : 0), loop: Infinity })
    }

    private *cycle() {
        yield* remodel(this)
            .format("big-ball")
            .color("#e0d8ff")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player)
            .nway(15, T / 20)
            .g((me) => Behavior.accel(me, 60, 3.6))
            .fire(this.game.bullets)

        yield* Array(55)
    }
}
