import { vec, Vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Size } from "../Size"

// 前作の StageDust(蛇)を移したもの。前作は30fps・幅630の画面だったので、時間は2倍、速さと大きさは0.81倍にしてある。
// 頭は六つの節を引き連れて、画面の中と外を大きく泳ぐ。泳ぎ方は「左右に薙ぐ」「八の字」「渦」「自機に飛びかかる」の順にくり返す。
// 頭は触れると当たる。飛びかかっている間を除いて、色の移ろう小さな弾をばらばらの向きへ撒き続ける。
// 飛びかかるたびに、自機の方へ開いた二本のビームを伸ばしてから閉じる。
// 節は動いていると、その場に色の移ろう大きな輪の弾を置いていく。輪は大きくなり、少し留まって消える。
// 節には尻尾の側から一つずつしか攻撃が効かない。節を一つ落とすたびに、頭のまわりを回る分身が一つ増える。
// 分身には攻撃が効かず、白い玉(縮みきると矢を放つ)と、大きな輪の弾の11方向撃ちを交互に使う。
// 節をすべて落とすと頭に攻撃が効くようになる。頭を落とすと分身も消える。

export default class extends Stage {
    *G() {
        yield* Array(60)

        const head = new SnakeHead(this.game)
        const segments: SnakeSegment[] = []
        for (let i = 0; i < 6; i++) {
            segments.push(new SnakeSegment(this.game, i === 0 ? head : segments[i - 1], i))
        }
        this.game.enemies.push(head, ...segments)

        yield* Array(300)
        head.start()

        for (const segment of [...segments].reverse()) {
            segment.isInvincible = false
            yield* this.waitDead([segment])
            this.game.enemies.push(new DetachedTail(this.game, head))
        }

        head.isInvincible = false

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class SnakeHead extends Enemy {
    constructor(game: Game) {
        super(game, 1600, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true
        this.p = this.center().add(vec(0, -this.game.HEIGHT * 2))

        this.scripts.add(() => this.moveTo(this.center(), 240))
    }

    private center() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT / 2)
    }

    // 泳ぎ始め、体の当たり判定と弾撒きを始める
    start() {
        this.scripts.add(() => this.body(), { loop: Infinity })
        this.scripts.add(() => this.spray(), { loop: Infinity, id: "spray" })
        this.scripts.add(() => this.swim(), { loop: Infinity })
    }

    private *swim() {
        yield* this.sweep()
        yield* this.figure8()
        yield* this.spiral()
        yield* this.chase()
    }

    // 毎フレーム、頭と同じ所に、頭より少し小さい輪の弾を置く。弾は2フレームで消える。輪の色相は60フレームごとに30°ずつ移る
    private *body() {
        yield
        yield* remodel(this)
            .colorful(Math.floor(this.frame / 60) * 30)
            .r(52)
            .speed(0)
            .p(this.p.clone())
            .delete(1)
            .fire(this.game.bullets)
    }

    // 2フレームごとに、色の移ろう小さな弾を一発、ばらばらの向きへ撃つ
    private *spray() {
        yield* Array(2)
        yield* remodel(this)
            .colorful(this.frame)
            .appearance("ball")
            .r(5)
            .speed(3.24)
            .radian((this.frame / 2) ** 2)
            .p(this.p.clone())
            .fire(this.game.bullets)
    }

    // frame フレームかけて end へ動く。緩急は easing で決まる
    private *glide(end: Vec, frame: number, easing: (t: number) => number) {
        const start = this.p

        for (let i = 1; i < frame + 1; i++) {
            this.p = start.add(end.sub(start).scale(easing(i / frame)))
            yield
        }
    }

    // 右端へ寄り、右下から左上へ斜めに横切り、左端を下り、真ん中へ戻る
    private *sweep() {
        yield* this.glide(this.center().add(vec(this.game.WIDTH * 0.42, 0)), 120, Ease.InOut)
        yield* this.glide(this.center().add(vec(this.game.WIDTH * 0.42, this.game.HEIGHT * 0.2)), 60, Ease.InOut)
        yield* this.glide(this.center().add(vec(-this.game.WIDTH * 0.42, -this.game.HEIGHT * 0.2)), 120, Ease.InOut)
        yield* this.glide(this.center().add(vec(-this.game.WIDTH * 0.42, 0)), 240, Ease.InOut)
        yield* this.glide(this.center(), 120, Ease.InOut)
    }

    // 縦に長い八の字を一周する。上下の端では画面の外まで出る
    private *figure8() {
        for (let i = 0; i <= 20; i++) {
            yield* this.moveTo(
                this.center().add(
                    vec(
                        Math.sin((i / 20) * T) * this.game.WIDTH * 0.38,
                        (-0.2 + Math.sin((i / 20) * T * 2) * 0.8) * this.game.HEIGHT,
                    ),
                ),
                30,
            )
        }
    }

    // 画面の外から真ん中へ渦を巻いて入り、また渦を巻いて画面の外へ出ていく
    private *spiral() {
        for (let i = 0; i <= 10; i++) {
            const angle = (i / 10) * T * 3
            const radius = (1 - i / 10) * this.game.WIDTH * 0.8
            yield* this.moveTo(this.center().add(vec(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.6)), 60)
        }

        for (let i = 0; i <= 10; i++) {
            const angle = (i / 10) * T * 2
            const radius = (i / 10) * this.game.HEIGHT * 0.8
            yield* this.moveTo(this.center().add(vec(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.5)), 60)
        }
    }

    // 弾撒きをやめ、自機までの95%の所へ飛びかかっては、自機の方へ左右30°に開いた二本のビームを伸ばし、閉じる。これを4回くり返す。
    // そのあと自機から遠ざかる向きへ離れ、弾撒きを再開する
    private *chase() {
        this.scripts.remove("spray")

        for (let k = 0; k < 4; k++) {
            yield* this.moveTo(this.p.add(this.game.player.p.sub(this.p).scale(0.95)), 60)

            const aim = this.game.player.p.sub(this.p).radian()

            yield* remodel(this)
                .beam(0)
                .r(10)
                .color("#00ffff")
                .duplicate(2, (b, i) => {
                    b.radian = aim + ((2 * i - 1) * T) / 12
                    return b
                })
                .g(function* (b) {
                    yield* Behavior.ease(b, "length", 260, 30, Ease.Out)
                    yield* Behavior.ease(b, "radian", aim, 10, Ease.Out)
                    yield* Behavior.fadeout(b, 30)
                })
                .fire(this.game.bullets)

            yield* Array(70)
        }

        const away = this.p.add(vec.arg(this.p.sub(this.game.player.p).radian()).scale(this.game.WIDTH * 0.72))
        yield* this.moveTo(
            vec(
                Math.max(this.game.WIDTH * 0.08, Math.min(this.game.WIDTH * 0.92, away.x)),
                Math.max(this.game.HEIGHT * 0.05, Math.min(this.game.HEIGHT * 0.5, away.y)),
            ),
            180,
        )
        yield* Array(60)

        this.scripts.add(() => this.spray(), { loop: Infinity, id: "spray" })
    }
}

// 節。一つ前の節(先頭の節は頭)から49以上離れると、離れた分の13%ずつ毎フレーム近づく。頭に近い節ほど大きく、体力も多い
class SnakeSegment extends Enemy {
    constructor(
        game: Game,
        private readonly prev: Enemy,
        private readonly index: number,
    ) {
        super(game, 800 - index * 14, Size.L - index * 2, { renderer: new EnemyRendererCore() })
        this.isInvincible = true
        this.p = prev.p.clone()

        this.scripts.add(() => this.follow(), { loop: Infinity })
        this.scripts.add(() => this.trail(), { margin: 60 })
    }

    private *follow() {
        const diff = this.prev.p.sub(this.p)
        const distance = diff.magnitude()

        if (distance > 49) this.p = this.p.add(diff.scale(((distance - 49) / distance) * 0.134))
        yield
    }

    // 前に調べた所から0.81より多く動いていたら、その場に色の移ろう輪の弾を置き、60フレーム休む。
    // 輪は30フレームかけて薄い姿から濃くなり(その間は当たらない)、30フレーム留まって、30フレームかけて消える。
    // 休んだあとは、輪を置いた所から動いた分で調べるので、動き続けている間は61フレームごとに輪を置く
    private *trail() {
        let before = this.p.clone()

        while (true) {
            yield

            const moved = this.p.sub(before).magnitude()
            before = this.p.clone()
            if (moved <= 0.81) continue

            yield* remodel(this)
                .colorful(this.frame + this.index * 30)
                .r(28)
                .speed(0)
                .p(this.p.clone())
                .appear(30)
                .g(function* (b) {
                    yield* Array(60)
                    yield* Behavior.fadeout(b, 30)
                })
                .fire(this.game.bullets)

            yield* Array(60)
        }
    }
}

// 分身。攻撃が効かない。頭のまわりの、横の半径が122〜228の間で波打つ楕円(縦は横の0.7倍)を、300フレームで一周する。
// 現れてから60フレームかけて大きくなる
class DetachedTail extends Enemy {
    constructor(game: Game, head: Enemy) {
        super(game, 400, Size.S)
        this.isInvincible = true

        this.setParent(head, () => this.orbit())
        this.scripts.add(() => this.grow())
        this.scripts.add(() => this.attack(), { loop: Infinity, margin: 60 })
    }

    private orbit() {
        const radius = 175 + Math.sin(this.frame / 180) * 53
        const angle = (this.frame / 300) * T
        return vec(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.7)
    }

    private *grow() {
        for (let i = 1; i < 61; i++) {
            this.r = (i / 60) * Size.S
            yield
        }
    }

    private *attack() {
        yield* this.egg()
        yield* this.spread()
    }

    // その場に白い玉を置き、240フレーム休む。玉は120フレーム留まってから60フレームかけて縮み、縮みきると矢を放って消える
    private *egg() {
        yield* remodel(this)
            .appearance("ball")
            .color("#ffffff")
            .r(23)
            .speed(0)
            .p(this.p.clone())
            .g(function* (b) {
                yield* Array(120)
                yield* Behavior.ease(b, "r", 1, 60, Ease.In)
                this.scripts.add(() => this.hatch(b.p.clone()))
                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(240)
    }

    // p から、いま自機のいる所へ向けて五方向に矢を放つ。8フレームおきに4回。
    // 矢は4フレームごとに9.72ずつ跳ぶように進み、向きは0.25ラジアン刻みで左右に揺れる
    private *hatch(p: Vec) {
        const target = this.game.player.p.clone()

        for (let k = 0; k < 4; k++) {
            yield* remodel(this)
                .format("arrow")
                .r(23)
                .color("#ffffff")
                .p(p)
                .aim({ p: target })
                .speed(0)
                .ex(5)
                .g(function* (b) {
                    const base = b.radian
                    for (let i = 0; i < 400; i++) {
                        b.radian = Math.floor((base + Math.sin(i / 20) * 0.4) * 4) / 4
                        yield
                    }
                })
                .g(function* (b) {
                    while (true) {
                        b.p = b.p.add(vec.arg(b.radian).scale(9.72))
                        yield* Array(4)
                    }
                })
                .fire(this.game.bullets)

            yield* Array(8)
        }
    }

    // 色の移ろう大きな輪の弾を11方向へ撃ち、120フレーム休む。
    // 弾は20フレームかけて薄い姿から濃くなりながら進み(その間は当たらない)、40フレームかけて止まり、40フレームかけて速さ3.65まで加速する
    private *spread() {
        yield* remodel(this)
            .colorful(this.frame / 2 + 120)
            .r(28)
            .p(this.p.clone())
            .speed(2.43)
            .radian((T * this.frame) / 480)
            .ex(11)
            .appear(20)
            .g(function* (b) {
                yield* Array(20)
                yield* Behavior.stop(b, 40)
                yield* Behavior.accel(b, 40, 3.65)
            })
            .fire(this.game.bullets)

        yield* Array(120)
    }
}
