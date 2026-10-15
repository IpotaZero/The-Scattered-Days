import { Vec, vec } from "@ipota/vec"
import { MathEx } from "../../../utils/Functions/MathEx"
import { Actor } from "../Actor"
import { Motion } from "./Motion"
import { Boundary } from "./Boundary"
import { Polygon } from "./Polygon"
import { uid } from "../../../utils/Functions/uid"
import { Game } from "../../Game"
import { IteratorManager } from "../../IteratorManager"

// 鏡が取り去られた双子が薄れて消えるまで
const TWIN_FADE_FRAMES = 24
// 鏡に映った双子の濃さの上限。本物の弾より少し薄くして、どれが鏡に映った弾か分かるようにする
const REFLECTION_ALPHA = 0.6

// 弾を映す鏡。center を通る angle 向きの線。angle は途中で変わってもよく、双子は毎フレームいまの鏡に映る。
// isActive() が偽になる(鏡が取り去られる)と、双子は薄れて消える
export type Reflector = { readonly center: Vec; readonly angle: number; isActive(): boolean }

export class Bullet extends Actor {
    r: number = 12
    radian: number = 0
    speed: number = 8
    // collision が rect のときだけ読まれる
    length: number = 0
    damage: number = 1
    isScorable: boolean = true

    delay: number = 0

    // cloneで作り直すのでreadonlyにしない
    scripts = new IteratorManager()

    // 毎フレーム、motion で進み、boundary で消えるかを確かめてから scripts を進める
    motion: Motion.Type = Motion.straight
    boundary: Boundary.Type = Boundary.screen
    appearance:
        | "donut"
        | "ball"
        | "line"
        | "arrow"
        /** 画面上の二点を結ぶ線分型の攻撃 */
        | "laser"
        /** 砲塔から延びる半直線型の攻撃 */
        | "beam"
        | "player"
        | "score"
        | Polygon.Type = "donut"
    collision: "circle" | "line" | "arrow" | "rect" | Polygon.Type = "circle"
    type: "friend" | "enemy" | "neutral" | "effect" | "score" = "enemy"
    color: Color = "black"
    alpha: number = 1

    // 双子(ほかの弾の姿を写し取っている弾)かどうか
    private isTwin = false
    // 自分の姿を写し取っている双子。自分がスコアに変わるとき、双子も一緒にスコアに変える
    private twins: Bullet[] = []

    private scriptReservations: [
        g: (me: Bullet) => Generator<unknown, unknown, void>,
        config: { loop?: number; margin?: number; id?: string },
    ][] = []

    // owner はこの弾を撃った者。撃った敵が倒れると、その敵の弾は花粉に変わる(Game.cancelBulletsOf)
    constructor(
        game: Game,
        readonly owner: Actor,
    ) {
        super(game)
    }

    clone() {
        const b = Object.assign(new Bullet(this.game, this.owner), this)

        // 参照型のプロパティは共有しないよう作り直す
        b.p = this.p.clone()
        b.scriptReservations = [...this.scriptReservations]
        b.scripts = new IteratorManager()
        b.twins = []

        return b
    }

    // 鏡 mirror を挟んで、自分と鏡写しになる弾(双子)を作る。双子は本物より少し薄い
    reflection(mirror: Reflector): Bullet {
        return this.reflect(mirror, 0)
    }

    // すでに飛んでいる自分を、いま現れた鏡 mirror に映す。
    // 双子は急に現れないよう、薄い姿から濃くなっていき、濃くなりきってから当たり判定が生まれる。
    // 返した双子は、呼び出した側が game.bullets に加える
    reflectNow(mirror: Reflector): Bullet {
        const twin = this.reflect(mirror, TWIN_FADE_FRAMES)
        twin.init()
        return twin
    }

    private reflect(mirror: Reflector, fadeIn: number): Bullet {
        return this.twin(
            mirror.center,
            () => mirror.isActive(),
            (p) => MathEx.reflect(p, mirror.center, mirror.angle),
            (radian) => 2 * mirror.angle - radian,
            REFLECTION_ALPHA,
            fadeIn,
        )
    }

    // center を中心に、自分を angle だけ回した位置にいる弾(双子)を作る
    rotation(center: Vec, angle: number): Bullet {
        return this.twin(
            center,
            () => true,
            (p) => center.add(p.sub(center).rotate(angle)),
            (radian) => radian + angle,
            1,
            0,
        )
    }

    // 自分の位置を point で、向きを direction で写した弾(双子)を作る。point は center からの距離を変えない写し方に限る。
    // 双子は自分では動かず、毎フレーム自分の位置・向き・見た目・当たり判定を写し取り、自分が消えると一緒に消える。
    // isActive() が偽になると、写し取るのをやめずに薄れて消える(薄れ始めた瞬間に当たり判定はなくなる)。
    // 自分だけ先に画面の外へ出て消えると、まだ画面の中にいる双子まで消えてしまう。
    // そこで画面の端で消すのをやめ、center から画面のどの角よりも遠く離れたとき(=双子もみな画面の外にいるとき)に消える。
    // fadeIn フレームかけて薄い姿から現れる(その間は当たり判定がない)
    private twin(
        center: Vec,
        isActive: () => boolean,
        point: (p: Vec) => Vec,
        direction: (radian: number) => number,
        maxAlpha: number,
        fadeIn: number,
    ): Bullet {
        const original = this

        const twin = this.clone()
        twin.scriptReservations = []
        twin.isTwin = true
        twin.motion = Motion.still
        twin.boundary = Boundary.none
        twin.p = point(this.p)
        twin.radian = direction(this.radian)
        this.twins.push(twin)

        // 自分は画面の端ではなく、center から画面のどの角よりも遠く離れたときに消える。
        // 自分が双子なら、元の弾を写し取る処理の中で消えるので、そのままにする
        if (!this.isTwin) {
            const { WIDTH, HEIGHT } = this.game
            const corners = [vec(0, 0), vec(WIDTH, 0), vec(0, HEIGHT), vec(WIDTH, HEIGHT)]
            this.boundary = new Boundary.FarFrom(center, Math.max(...corners.map((c) => c.sub(center).magnitude())))
        }

        // 双子は元の弾を写し取り、元の弾が消えるか鏡が取り去られると消える
        twin.bookScript(function* (me) {
            const follow = () => {
                me.p = point(original.p)
                me.radian = direction(original.radian)
                me.r = original.r
                me.color = original.color
            }

            for (let f = 0; original.life > 0 && isActive(); f++) {
                const appear = fadeIn > 0 ? Math.min(1, f / fadeIn) : 1

                follow()
                me.alpha = Math.min(original.alpha, maxAlpha) * appear
                me.type = appear < 1 ? "neutral" : original.type
                yield
            }

            me.type = "neutral"
            const alpha = me.alpha

            for (let f = 1; f <= TWIN_FADE_FRAMES && original.life > 0; f++) {
                follow()
                me.alpha = alpha * (1 - f / TWIN_FADE_FRAMES)
                yield
            }

            me.life = 0
        })

        return twin
    }

    init() {
        this.scriptReservations.forEach(([g, config]) => {
            this.scripts.add(() => g(this), config)
        })

        this.update()
    }

    update() {
        this.motion.step(this)
        if (this.boundary.isOut(this)) this.life = 0
        this.scripts.update()
    }

    bookScript(
        g: (me: Bullet) => Generator<unknown, unknown, void>,
        { loop = 1, margin = 0, id = uid() }: { loop?: number; margin?: number; id?: string } = {},
    ) {
        this.scriptReservations.push([g, { loop, margin, id }])
    }

    // scoreタイプに変え、自機へのホーミングを開始する。双子も一緒に、それぞれの場所からホーミングさせる
    scorenize() {
        if (this.type === "score") return
        this.becomeScore()

        this.motion = Motion.homing
        this.boundary = Boundary.none

        this.twins.forEach((t) => t.scorenize())
    }

    // scoreタイプに変え、下へ落ちていく。自機が近くに寄ればホーミングして回収され、取りに行かなければ画面の外へ消える。
    // 双子も一緒に、それぞれの場所から落とす
    scorenizeToFall() {
        if (this.type === "score") return
        this.becomeScore()

        this.motion = Motion.still
        this.boundary = Boundary.screen
        this.scripts.add(() => this.fall(this))

        this.twins.forEach((t) => t.scorenizeToFall())
    }

    // 双子は元の弾の位置と色だけを写し取っていて、見た目は写さない。
    // 元の弾がスコアに変わったときは、写し取るのをやめて自分もスコアになる(scorenize / scorenizeToFall が双子にも伝える)
    private becomeScore() {
        this.type = "score"
        this.appearance = "score"
        this.collision = "circle"
        this.r = 8
        this.alpha = 0.8
        this.color = "#ecce74"
        this.isScorable = false

        this.scripts.clear()
    }

    // 少し跳ね上がってから、ゆっくり加速して落ちる。自機が近くに来たら、そこからホーミングして回収される
    private *fall(me: Bullet) {
        let vy = -2

        while (me.game.player.p.sub(me.p).magnitude() > me.game.player.GRAZE_R * 4) {
            vy = Math.min(vy + 0.2, 4)
            me.p.y += vy
            yield
        }

        // ホーミング中は自機を追い続けて画面の外へは出ないので、画面の端では消えないようにする
        me.motion = Motion.homing
        me.boundary = Boundary.none
    }
}
