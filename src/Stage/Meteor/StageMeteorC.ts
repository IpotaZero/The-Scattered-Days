import { vec, Vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/Enemy/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Part } from "../Part"
import { Size } from "../Size"
import { Meteor } from "./Meteor"

export default class extends Stage {
    *G() {
        const master = new EnemyPolaris(this.game)
        this.game.enemies.push(master, ...master.stars)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPolaris extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.15, this.game.HEIGHT * 0.03, 1, 2)

    readonly stars: Star[] = [
        vec(2.4, 0.05),
        vec(1.85, -0.15),
        vec(1.4, 0),
        vec(0.85, 0.15),
        vec(0.75, 0.65),
        vec(0.1, 0.55),
        vec(0, 0),
    ].map((p, i, all) => {
        const center = all.reduce((sum, q) => sum.add(q), vec(0, 0)).scale(1 / all.length)
        const offset = p.sub(center).scale(100)

        // 柄の先から順に次の星と結ぶ。升の最後の星(6)は、升の最初の星(3)と結ぶ
        return new Star(this.game, this, offset, i, () => this.stars[[1, 2, 3, 4, 5, 6, 3][i]])
    })

    constructor(game: Game) {
        super(game, 1600, Size.MASTER, { renderer: new EnemyRendererCore() })
        this.isInvincible = true

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.guard())
    }

    // 七つの星がすべて倒れるまで、攻撃が効かない
    private *guard() {
        while (this.stars.some((s) => s.life > 0)) yield
        this.isInvincible = false
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.arrows(), { loop: Infinity, margin: 80 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.3)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 300).add(this.home())
        yield
    }

    private *arrows() {
        yield* remodel(this)
            .format("arrow")
            .color("#ffffff")
            .p(this.p.clone())
            .speed(1)
            .aim(this.game.player)
            .nway(5, T / 24)
            .g((me) => Behavior.ease(me, "speed", 7.5, 45, Ease.In))
            .fire(this.game.bullets)

        yield* Array(60)
    }
}

class Star extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly offset: Vec,
        private readonly i: number,
        private readonly next: () => Enemy,
    ) {
        super(game, parent, 450, Size.S, 150)
    }

    protected place() {
        const angle = this.frame / 95
        return vec.arg(angle).scale(175).add(this.offset.rotate(angle))
    }

    // 次の星との間に星座の線を引き、線は弾12発に砕けて北極星から遠ざかる向きへ飛ぶ(Meteor.link)。160フレームおき
    protected *attack() {
        yield* Array(this.i * 10)
        yield* Meteor.link(this, this, this.next(), this.parent, 12, 4, this.i % 2 === 0 ? "#fff4b0" : "#b8e0ff")
        yield* Array(110 - this.i * 10)
    }
}
