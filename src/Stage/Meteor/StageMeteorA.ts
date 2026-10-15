import { vec } from "@ipota/vec"
import { Ease, GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/Enemy/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Meteor } from "./Meteor"
import { Size } from "../Size"

export default class extends Stage {
    *G() {
        const pupil = new EnemyPupil(this.game)
        this.game.enemies.push(pupil, ...[0, 1, 2, 3].map((i) => new EnemyStardust(this.game, pupil, i)))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.5, this.game.HEIGHT * 0.08, 2, 3)

    constructor(game: Game) {
        super(game, 2400, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 400).add(this.home())
        yield
    }

    // 流星群を三度降らせる。二度目は一度目と左右を逆にした向きから降るので、一度目の尾と交わって格子になる
    private *cycle() {
        const side = this.random() < 0.5 ? -1 : 1

        yield* GenUtils.all({
            first: this.shower(0, side),
            second: this.shower(110, -side),
            third: this.shower(240, side),
            wait: Array(500),
        })
    }

    private *shower(wait: number, side: number) {
        yield* Array(wait)
        yield* Meteor.shower(this, T / 4 + side * (T / 14 + (this.random() * T) / 14), 70, 0.7, {
            preview: 50,
            speed: 10,
            tailInterval: 2,
            tailLife: 40,
            color: "#fff4b0",
        })
    }
}

class EnemyStardust extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 600, Size.S)

        this.setParent(parent, () => vec.arg(this.frame / 60 + (T * index) / 4).scale(110))

        if (index % 2 === 0) {
            this.scripts.add(() => this.fan(), { loop: Infinity, margin: 150 + index * 20 })
        } else {
            this.scripts.add(() => this.ring(), { loop: Infinity, margin: 170 + index * 20 })
        }
    }

    private *fan() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffe080")
            .p(this.p.clone())
            .speed(1.5)
            .aim(this.game.player)
            .nway(5, T / 24)
            .g((me) => Behavior.ease(me, "speed", 5, 40, Ease.In))
            .fire(this.game.bullets)

        yield* Array(50)
    }

    private *ring() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#b8d8ff")
            .p(this.p.clone())
            .speed(4)
            .radian(this.random() * T)
            .ex(24)
            .g((me) => Behavior.reaccel(me, 20, 20, 30, 3.5))
            .fire(this.game.bullets)

        yield* Array(80)
    }
}
