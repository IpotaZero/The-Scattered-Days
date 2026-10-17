import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy/Enemy"
import { EnemyRendererBoss } from "../../Game/Actor/Enemy/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/Enemy/EnemyRendererCore"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Part } from "../Part"
import { Size } from "../Size"
import { Stage } from "../Stage"

// The Twilight Days の Stage1 の移植。
// 前作はFPSも画面の幅も違ったので、フレーム数はFPSの比で伸ばし、長さは画面の幅の比で縮め、速さはその両方で割ってある。
// 前作がBGMの再生位置で区切っていた所は、敵が全滅するか時間が来るまで待つようにした。台詞と立ち絵は除いた
export default class extends Stage {
    *G() {
        for (let i = 0; i < 12; i++) this.game.enemies.push(new Row(this.game, i, "magenta"))
        yield* Array(60)

        for (let i = 0; i < 12; i++) this.game.enemies.push(new Row(this.game, i, "magenta"))
        yield* Array(60)

        for (let i = 0; i < 12; i++) this.game.enemies.push(new Row(this.game, i, "cyan"))
        yield* Array(360)

        for (let h = 0; h < 4; h++) {
            for (const side of [-1, 0, 1]) this.game.enemies.push(new Lander(this.game, side))
            yield* Array(30)
        }
        yield* Array(180)

        for (const side of [-1, 1]) this.game.enemies.push(new Scatterer(this.game, side))
        yield* Array(60)

        for (let i = 0; i < 4; i++) {
            this.game.enemies.push(new Carrier(this.game))
            yield* Array(60)
        }
        yield* Array(60)

        for (let i = 0; i < 4; i++) {
            this.game.enemies.push(new ThinFan(this.game))
            yield* Array(30)
        }
        yield* Array(60)

        for (let i = 0; i < 4; i++) {
            this.game.enemies.push(new ThickFan(this.game))
            yield* Array(30)
        }
        yield* this.sweep(240)

        this.game.enemies.push(new MiddleBoss(this.game))
        yield* this.sweep(1140)
        yield* Array(120)

        for (let i = 0; i < 12; i++) {
            this.game.enemies.push(new Crosser(this.game, i))
            yield* Array(30)
        }

        for (let i = 0; i < 8; i++) {
            this.game.enemies.push(new Orbiter(this.game))
            yield* Array(30)
            this.game.enemies.push(new Slider(this.game))
            yield* Array(30)
        }
        yield* this.sweep(660)
        yield* Array(180)

        this.game.enemies.push(new Boss(this.game))
        yield* Array(30)

        this.flash("#ff000060", 35)
        this.shake(8, 35)

        yield* this.waitAllEnemiesDead()
    }

    // 敵が全滅するか frames フレーム経つまで待つ。残った敵はその場で倒れる
    private *sweep(frames: number) {
        for (let i = 0; i < frames && this.game.enemies.length > 0; i++) yield

        this.game.enemies.forEach((e) => {
            e.life = 0
        })
    }
}

namespace Hue {
    // 時間とともに、赤紫から赤・黄を経て緑までの色相を行き来する
    export function swing(frame: number): Color {
        return `hsl(${Math.floor(120 * Math.sin((T * frame) / 240) + 390) % 360},100%,50%)`
    }
}

// 横一列に並んで画面の上からゆっくり降り、自機へ向けて数発撃つ。撃った弾は減速する
class Row extends Enemy {
    constructor(
        game: Game,
        i: number,
        private readonly color: Color,
    ) {
        super(game, 25, Size.S)
        this.p = vec(game.WIDTH / 2 + 32 * (i - 5.5), -64)

        this.scripts.add(() => this.drift(vec(0, 1)))
        this.scripts.add(() => this.attack(), { loop: 3, margin: 60 })
    }

    private *attack() {
        yield* remodel(this)
            .format("donut")
            .color(this.color)
            .p(this.p.clone())
            .speed(4)
            .aim(this.game.player)
            .g((me) => Behavior.accel(me, 30, 3))
            .fire(this.game.bullets)

        yield* Array(36)
    }
}

// 画面の上の端まで滑り込んでからゆっくり降り、自機へ向けて撃ち続ける。撃った弾は減速する
class Lander extends Enemy {
    constructor(
        game: Game,
        private readonly side: number,
    ) {
        super(game, 25, Size.S)
        this.p = vec(game.WIDTH / 2 + 128 * side, -64)

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.attack(), { loop: 36, margin: 60 })
    }

    private *enter() {
        yield* this.moveTo(vec(this.game.WIDTH / 2 + 128 * this.side, 0), 30)
        yield* this.drift(vec(0, 1))
    }

    private *attack() {
        yield* remodel(this)
            .format("donut")
            .color("magenta")
            .p(this.p.clone())
            .speed(6)
            .aim(this.game.player)
            .g((me) => Behavior.accel(me, 30, 3))
            .fire(this.game.bullets)

        yield* Array(24)
    }
}

// 左右に並んで画面の上からゆっくり降り、ばらばらな向きの放射弾を立て続けに撃つ
class Scatterer extends Enemy {
    constructor(game: Game, side: number) {
        super(game, 150, Size.M)
        this.p = vec(game.WIDTH / 2 + 128 * side, -64)

        this.scripts.add(() => this.drift(vec(0, 1)))
        this.scripts.add(() => this.attack())
    }

    private *attack() {
        for (let k = 0; k < 12; k++) {
            yield* remodel(this)
                .format("donut")
                .color("magenta")
                .p(this.p.clone())
                .speed(6)
                .radian(this.random() * T)
                .ex(5)
                .fire(this.game.bullets)

            yield* Array(8)
        }
    }
}

// 両脇に砲台を連れて、画面の上の外から弧を描いて左へ抜けていく。自分では撃たない
class Carrier extends Enemy {
    constructor(game: Game) {
        super(game, 150, Size.L)

        game.enemies.push(new CarrierGun(game, this, -1), new CarrierGun(game, this, 1))
        this.scripts.add(() => this.move(), { loop: Infinity })
    }

    private *move() {
        this.p = vec(0, -64).add(vec(320, 0).rotate((T / 8) * (this.frame / 288)))
        if (this.p.x < -this.r) this.hasLeft = true
        yield
    }
}

// Carrier の脇について回り、自機へ向けて撃ち続ける。撃った弾は減速する
class CarrierGun extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 25, Size.S, 0)
    }

    protected place() {
        return vec(64 * this.side, 0)
    }

    protected *attack() {
        yield* remodel(this)
            .format("donut")
            .color("cyan")
            .p(this.p.clone())
            .speed(6)
            .aim(this.game.player)
            .g((me) => Behavior.accel(me, 30, 3))
            .fire(this.game.bullets)

        yield* Array(24)
    }
}

// 画面の上から真ん中をゆっくり降り、自機の方を軸にした放射弾を撃ち続ける。撃った弾は減速する
class ThinFan extends Enemy {
    constructor(game: Game) {
        super(game, 12, Size.S)
        this.p = vec(game.WIDTH / 2, -64)

        this.scripts.add(() => this.drift(vec(0, 1)))
        this.scripts.add(() => this.attack(), { loop: Infinity })
    }

    private *attack() {
        yield* remodel(this)
            .format("donut")
            .color("magenta")
            .p(this.p.clone())
            .speed(4)
            .aim(this.game.player)
            .ex(3)
            .g((me) => Behavior.accel(me, 30, 3))
            .fire(this.game.bullets)

        yield* Array(24)
    }
}

// 画面の上から真ん中を ThinFan より速く降り、自機の方を軸にした濃い放射弾を撃ち続ける。撃った弾は減速する
class ThickFan extends Enemy {
    constructor(game: Game) {
        super(game, 125, Size.M)
        this.p = vec(game.WIDTH / 2, -64)

        this.scripts.add(() => this.drift(vec(0, 2)))
        this.scripts.add(() => this.attack(), { loop: Infinity })
    }

    private *attack() {
        yield* remodel(this)
            .format("donut")
            .color("magenta")
            .p(this.p.clone())
            .speed(4)
            .aim(this.game.player)
            .ex(7)
            .g((me) => Behavior.accel(me, 30, 3))
            .fire(this.game.bullets)

        yield* Array(24)
    }
}

// 画面の上の方まで降りてきて左右に揺れ、自機へ向けてときどき撃つ。撃った弾は減速する。
// 両脇に放射弾を撃つ翼を、その外側に真下へ弾を連ねる先端を連れている
class MiddleBoss extends Enemy {
    constructor(game: Game) {
        super(game, 1500, Size.MASTER, { renderer: new EnemyRendererCore() })
        this.p = vec(448, -64)

        game.enemies.push(
            new MiddleBossWing(game, this, -1),
            new MiddleBossWing(game, this, 1),
            new MiddleBossTip(game, this, -1),
            new MiddleBossTip(game, this, 1),
        )

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.attack(), { loop: Infinity, margin: 80 })
    }

    private *enter() {
        yield* this.moveTo(vec(this.game.WIDTH / 2, 96), 80)
        this.scripts.add(() => this.sway(), { loop: Infinity })
    }

    private *sway() {
        this.p = vec(this.game.WIDTH / 2 + 64 * Math.sin((this.frame - 80) / 48), 96)
        yield
    }

    private *attack() {
        yield* remodel(this)
            .format("donut")
            .color("crimson")
            .p(this.p.clone())
            .speed(6)
            .aim(this.game.player)
            .g((me) => Behavior.accel(me, 30, 3))
            .fire(this.game.bullets)

        yield* Array(48)
    }
}

// 向きを変えない濃い放射弾を休みなく撃ち、放射状に並ぶ弾の筋を作る。左右の翼の筋は鏡写しになる
class MiddleBossWing extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 400, Size.L, 90)
    }

    protected place() {
        return vec(96 * this.side, 0)
    }

    protected *attack() {
        yield* remodel(this)
            .format("donut")
            .color("cyan")
            .p(this.p.clone())
            .speed(6)
            .radian(this.side < 0 ? Math.PI : 0)
            .ex(7)
            .fire(this.game.bullets)

        yield* Array(12)
    }
}

// 真下へ弾を連ねて撃ち、少し休む
class MiddleBossTip extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 200, Size.S, 90)
    }

    protected place() {
        return vec(147 * this.side, 0)
    }

    protected *attack() {
        for (let k = 0; k < 6; k++) {
            yield* remodel(this)
                .format("donut")
                .color("magenta")
                .p(this.p.clone())
                .speed(6)
                .radian(T / 4)
                .fire(this.game.bullets)

            yield* Array(4)
        }

        yield* Array(12)
    }
}

// 画面の左右の端から交互に現れて横切る。現れてすぐに一度だけ放射弾を撃つ。弾は一度止まってから、また同じ向きへ飛んでいく
class Crosser extends Enemy {
    constructor(game: Game, i: number) {
        super(game, 25, Size.M)
        this.p = vec([0, game.WIDTH][i % 2], i * 32)

        this.scripts.add(() => this.drift(vec([4, -4][i % 2], 0)))
        this.scripts.add(() => this.attack(), { margin: 24 })
    }

    private *attack() {
        yield* remodel(this)
            .format("donut")
            .color("magenta")
            .p(this.p.clone())
            .speed(6)
            .ex(13)
            .g((me) => Behavior.reaccel(me, 12, 0, 12, 6))
            .fire(this.game.bullets)
    }
}

// 衛星を回しながら、画面の上の外から弧を描いて右へ抜けていく。自分では撃たない
class Orbiter extends Enemy {
    constructor(game: Game) {
        super(game, 125, Size.L)

        game.enemies.push(
            new OrbiterSatellite(game, this, 0),
            new OrbiterSatellite(game, this, 1),
            new OrbiterSatellite(game, this, 2),
        )
        this.scripts.add(() => this.move(), { loop: Infinity })
    }

    private *move() {
        this.p = vec(this.game.WIDTH, -64).add(vec(-320, 0).rotate(-(T / 8) * (this.frame / 288)))
        if (this.p.x > this.game.WIDTH + this.r) this.hasLeft = true
        yield
    }
}

// Orbiter のまわりを回りながら、自機へ向けてときどき撃つ。撃った弾は減速する
class OrbiterSatellite extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly k: number,
    ) {
        super(game, parent, 25, Size.S, 60)
    }

    protected place() {
        return vec(64, 0).rotate((T / 3) * this.k + T * (this.frame / 96))
    }

    protected *attack() {
        yield* remodel(this)
            .format("donut")
            .color("cyan")
            .p(this.p.clone())
            .speed(6)
            .aim(this.game.player)
            .g((me) => Behavior.accel(me, 30, 3))
            .fire(this.game.bullets)

        yield* Array(48)
    }
}

// 画面の左上の外から右へ滑り込み、ThinFan より速く降りながら自機へ向けて撃つ。撃った弾は減速する
class Slider extends Enemy {
    constructor(game: Game) {
        super(game, 25, Size.S)
        this.p = vec(64, -64)

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.attack(), { loop: 24 })
    }

    private *enter() {
        yield* this.moveTo(vec(320, 0), 120)
        yield* this.drift(vec(0, 2))
    }

    private *attack() {
        yield* remodel(this)
            .format("donut")
            .color("magenta")
            .p(this.p.clone())
            .speed(6)
            .aim(this.game.player)
            .g((me) => Behavior.accel(me, 30, 3))
            .fire(this.game.bullets)

        yield* Array(24)
    }
}

// 部位の組を順に呼び出し、一組すべて倒れるたびに画面の弾が花粉に変わって次の組が現れる。
// 部位が残っている間は攻撃が効かず、自機のいた所へ放射弾を続けざまに撃っては休む。
// 最後の組が倒れると攻撃が効くようになり、自機の方を軸に互いに逆向きに回る放射弾を重ねて休みなく撃つ
class Boss extends Enemy {
    private readonly path = Curves.lissajous(64, 32, 1 / 48, 1 / 96)

    constructor(game: Game) {
        super(game, 1500, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.p = vec(game.WIDTH / 2, -64)
        this.isInvincible = true

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.phases())
        this.scripts.add(() => this.attack(), { loop: Infinity, margin: 70 })
    }

    private *enter() {
        yield* this.moveTo(vec(this.game.WIDTH / 2, 128), 70)
        this.scripts.add(() => this.wander(), { loop: Infinity })
    }

    private *wander() {
        this.p = this.path(this.frame - 70).add(vec(this.game.WIDTH / 2, 128))
        yield
    }

    private *phases() {
        yield* this.summon([
            new BossCannon(this.game, this, -1),
            new BossCannon(this.game, this, 1),
            new BossFan(this.game, this, -1),
            new BossFan(this.game, this, 1),
        ])

        yield* this.summon([new BossSpinner(this.game, this, -1), new BossSpinner(this.game, this, 1)])

        yield* this.summon([
            new BossRebound(this.game, this, vec(-128, 0), Size.M),
            new BossRebound(this.game, this, vec(128, 0), Size.M),
            new BossRebound(this.game, this, vec(-64, 64), Size.S),
            new BossRebound(this.game, this, vec(64, 64), Size.S),
        ])

        yield* this.summon([new BossAimer(this.game, this, -1), new BossAimer(this.game, this, 1)])

        this.isInvincible = false
    }

    private *summon(parts: readonly Enemy[]) {
        this.game.enemies.push(...parts)
        while (parts.some((p) => p.life > 0)) yield
        this.game.stage.scorenizeAllBullets()
    }

    private *attack() {
        if (this.isInvincible) yield* this.volley()
        else yield* this.frenzy()
    }

    private *volley() {
        const target = this.game.player.p.clone()

        for (let k = 0; k < 6; k++) {
            yield* remodel(this)
                .format("donut")
                .color(Hue.swing(this.frame + 48))
                .p(this.p.clone())
                .speed(6)
                .radian(target.sub(this.p).radian() + this.frame / 144)
                .ex(13)
                .fire(this.game.bullets)

            yield* Array(4)
        }

        yield* Array(108)
    }

    private *frenzy() {
        yield* remodel(this)
            .format("donut")
            .color(Hue.swing(this.frame))
            .p(this.p.clone())
            .speed(5)
            .aim(this.game.player)
            .duplicate(2, (b, i) => {
                b.radian += ((2 * i - 1) * this.frame) / 144
                return b
            })
            .ex(13)
            .fire(this.game.bullets)

        yield* Array(20)
    }
}

// 自機のいた所へ、色の移ろう小さな玉を続けざまに撃っては休む
class BossCannon extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 500, Size.L, 60)
    }

    protected place() {
        return vec(128 * this.side, 0)
    }

    protected *attack() {
        const target = this.game.player.p.clone()

        for (let k = 0; k < 6; k++) {
            yield* remodel(this)
                .format("small-ball")
                .color(Hue.swing(this.frame))
                .p(this.p.clone())
                .speed(6)
                .aim({ p: target })
                .fire(this.game.bullets)

            yield* Array(2)
        }

        yield* Array(24)
    }
}

// 右から真下を通って左下へ、扇をなぞるように一発ずつ撃っては休む
class BossFan extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 500, Size.L, 0)
    }

    protected place() {
        return vec(64 * this.side, 32)
    }

    protected *attack() {
        for (let k = 0; k < 6; k++) {
            yield* remodel(this)
                .format("donut")
                .color(Hue.swing(this.frame))
                .p(this.p.clone())
                .speed(4)
                .radian(Math.PI * (k / 6))
                .fire(this.game.bullets)

            yield* Array(2)
        }

        yield* Array(24)
    }
}

// ばらばらな向きの、遅い小さな玉の放射弾を撃ち続ける
class BossSpinner extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 500, Size.M, 0)
    }

    protected place() {
        return vec(128 * this.side, 0)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .color(Hue.swing(this.frame))
            .p(this.p.clone())
            .speed(3)
            .radian(this.random() * T)
            .ex(13)
            .fire(this.game.bullets)

        yield* Array(24)
    }
}

// 向きを変えない放射弾を撃ち続ける。弾は一度止まってから、また同じ向きへ飛んでいく
class BossRebound extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly offset: Vec,
        r: number,
    ) {
        super(game, parent, 500, r, 0)
    }

    protected place() {
        return this.offset
    }

    protected *attack() {
        yield* remodel(this)
            .format("donut")
            .color(Hue.swing(this.frame))
            .p(this.p.clone())
            .speed(6)
            .ex(13)
            .g((me) => Behavior.reaccel(me, 12, 0, 12, 6))
            .fire(this.game.bullets)

        yield* Array(24)
    }
}

// 自機の方を軸にした放射弾を撃ち続ける
class BossAimer extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 500, Size.S, 0)
    }

    protected place() {
        return vec(64 * this.side, 64)
    }

    protected *attack() {
        yield* remodel(this)
            .format("donut")
            .color(Hue.swing(this.frame))
            .p(this.p.clone())
            .speed(4)
            .aim(this.game.player)
            .ex(13)
            .fire(this.game.bullets)

        yield* Array(24)
    }
}
