import { Actor } from "./Actor"
import { IteratorManager } from "../IteratorManager"
import { Game } from "../Game"
import { vec, Vec } from "@ipota/vec"
import { T } from "../../T"
import { Ctx } from "../../utils/Functions/Ctx"
import { Behavior, remodel } from "../Remodel"
import { Ease } from "@ipota/functions"
import type { MainEquipment, SubEquipment } from "../Equipment/PlayerEquipment"
import { PlayerRenderer } from "./PlayerRenderer"
import { TriangleParticle } from "./TriangleParticle"

const HIT_SHAKE_INTENSITY = 12
const HIT_SHAKE_FRAME = 60

// Player自身はセーブデータ(Data層)を知らない。呼び出し側(Scene層)が
// playerDataから読んだ値をここに詰めて渡す。被弾等で変化したlifeはScene層が終了時に読み取って保存する
export type PlayerConfig = {
    readonly initialLife: number
    readonly maxLife: number
    readonly mainEquipment: MainEquipment
    readonly subEquipment: SubEquipment | undefined
}

export class Player extends Actor {
    readonly GRAZE_R = 20

    override readonly r: number = 3

    readonly maxLife: number
    // ステージの中だけで使える追加残機の数。被弾するとlifeより先に減る。playerDataへは送り返さない
    extraLives = 0
    // このステージで被弾した回数。追加残機で受けた被弾と自爆も数える
    hitCount = 0
    readonly speed = 8
    readonly slowSpeed = 3

    // 装備(主にsub装備のaction)が移動速度・無敵状態・クールタイムを一時的に変えるためのフック
    // ブースト中の速さ(定値)。ブースト中でなければundefined
    boostSpeed: number | undefined
    isActionInvincible = false
    // action発動直後が1、クールタイムが明けると0(0の間はクールタイム表示を出さない)
    actionCooldownRemaining = 0

    // 直近フレームの移動速度(羽の傾き等、見た目の計算にのみ使う。PlayerRendererが読む)
    v: Vec = vec(0, 0)

    readonly renderer = new PlayerRenderer()

    readonly scripts = new IteratorManager()

    private readonly equipments: readonly (MainEquipment | SubEquipment)[]

    constructor(game: Game, startPosition: Vec, config: PlayerConfig) {
        super(game)
        this.p = startPosition
        // 残機はステージをまたいで引き継ぐ(値の出所はScene層のplayerData)
        this.life = config.initialLife
        this.maxLife = config.maxLife
        this.equipments = [config.mainEquipment, ...(config.subEquipment ? [config.subEquipment] : [])]

        this.scripts.add(() => this.pauseWhileStunned(config.mainEquipment.fire(this)), { loop: Infinity })
        if (config.subEquipment) this.scripts.add(() => config.subEquipment!.action(this))
    }

    // ステージの会話を装備で分岐させるためのもの。例: this.game.player.isEquipped(laser)
    isEquipped(equipment: MainEquipment | SubEquipment): boolean {
        return this.equipments.includes(equipment)
    }

    update(): void {
        super.update()
        this.move()
        this.renderer.update(this)
    }

    draw(ctx: CanvasRenderingContext2D): void {
        this.renderer.draw(ctx, this)
    }

    isInvincible() {
        return this.scripts.has("invincible") || this.isActionInvincible
    }

    // 被弾後の無敵の間。主装備は撃たない(技による無敵は含まない)
    isStunned() {
        return this.scripts.has("invincible")
    }

    // ダッシュ等でboostSpeedが設定されている状態
    isBoosted() {
        return this.boostSpeed !== undefined
    }

    // 被弾処理: ライフを減らし、しばらく無敵にする
    hit(damage: number) {
        if (this.isInvincible()) return

        this.hitCount++
        if (this.extraLives > 0) {
            this.extraLives--
        } else {
            this.life = Math.max(-1, this.life - damage)
        }
        this.game.se.hit.play()
        this.game.camera.shake(HIT_SHAKE_INTENSITY, HIT_SHAKE_FRAME)

        this.scripts.add(() => this.stun(), { id: "invincible" })

        if (this.life < 0) {
            this.die()
        } else {
            this.scripts.add(() => this.hitField(), { id: "hitField" })
        }
    }

    // 自爆: 無敵時間に関係なく強制的にゲームオーバーにする。被弾と同じ弾処理リングは出す
    selfDestruct() {
        this.hitCount++
        this.life = Math.max(-1, this.life - 1)

        this.game.se.hit.play()
        this.game.camera.shake(HIT_SHAKE_INTENSITY, HIT_SHAKE_FRAME)

        this.die()
    }

    // ゲームオーバーにする。以後Gameは自機を更新しないので、破片はGameのスクリプトとして撒く
    private die() {
        this.game.lose()
        this.game.scripts.add(() => this.explode())
    }

    // 三角形の破片を撒き散らす。当たり判定を持たないeffect弾として実装
    private *explode() {
        yield* remodel(this)
            .p(this.p.clone())
            .type("effect")
            .appearance("triangle")
            .color("white")
            .alpha(0.5)
            .duplicate(16, (b) => {
                b.r = Math.random() * 8 + 8
                b.speed = Math.random() * 2 + 2
                b.radian = Math.random() * T
                return b
            })
            .g((me) => Behavior.fadeout(me, 60))
            .fire(this.game.bullets)
    }

    // 被弾後の無敵。120フレームかけて、自機のまわりに#59A4FFの三角形を頂点から一辺ずつ描き足していき、
    // 描き終わったフレームで無敵が解ける。その間、主装備は撃たない(isStunned)
    private *stun() {
        const frame = 120
        const radius = this.GRAZE_R * 2.5

        for (let i = 1; i < frame + 1; i++) {
            const drawn = (i / frame) * 3

            this.game.drawInWorld((ctx) => {
                const vertices = [0, 1, 2, 3].map((k) => this.p.add(vec(radius, 0).rotate(-T / 4 + (T / 3) * k)))

                ctx.lineWidth = 2

                ctx.strokeStyle = "rgba(89, 164, 255, 0.2)"
                ctx.beginPath()
                ctx.moveTo(vertices[0]!.x, vertices[0]!.y)
                for (let k = 1; k <= 3; k++) ctx.lineTo(vertices[k]!.x, vertices[k]!.y)
                ctx.stroke()

                ctx.strokeStyle = "#59A4FF"
                ctx.beginPath()
                ctx.moveTo(vertices[0]!.x, vertices[0]!.y)
                for (let k = 0; k < Math.ceil(drawn); k++) {
                    const end = vertices[k]!.add(vertices[k + 1]!.sub(vertices[k]!).scale(Math.min(1, drawn - k)))
                    ctx.lineTo(end.x, end.y)
                }
                ctx.stroke()
            })

            yield
        }
    }

    // gを毎フレーム一歩ずつ進める。isStunnedの間は進めない(すでに撃った弾はそのまま飛ぶ)
    private *pauseWhileStunned(g: Generator<void, void, void>) {
        while (true) {
            while (this.isStunned()) yield
            if (g.next().done) return
            yield
        }
    }

    // 被弾した瞬間に自機を中心としたリングを広げ、触れた敵弾をスコアに変える。
    // このスコアは自機へ寄ってこず落ちていくので、拾うには取りに行く必要がある。
    // 無敵時間と同じくscripts任せで進行させ、見た目もこの中で完結させて描いてしまう
    // (Playerに専用フィールドを持たせない)
    private *hitField() {
        const frame = 60
        const center = this.p.clone()

        for (let i = 1; i < frame + 1; i++) {
            const radius = Ease.Out(i / frame) * this.game.WIDTH
            const alpha = 1 - i / frame

            // 毎フレーム全弾を見るので、filterで配列を作らずに一度で振り分ける(GC対策)
            this.game.bullets.forEach((b) => {
                if (b.type !== "enemy" || !b.isScorable) return
                if ((b.p.x - center.x) ** 2 + (b.p.y - center.y) ** 2 > radius ** 2) return

                b.scorenizeToFall()
            })

            this.game.drawInWorld((ctx) =>
                Ctx.arc(ctx, center, radius, `rgba(255, 255, 255, ${alpha})`, { lineWidth: 2 }),
            )

            yield
        }
    }

    private move() {
        const input = this.game.input

        // タッチドラッグ中は、指の移動量(ワールド座標のベクトル)にドラッグ係数を掛けたものを速度にする
        const touchMoveVector = input.getTouchMoveVector?.()

        if (touchMoveVector) {
            this.v = touchMoveVector
        } else {
            // スティックの倒し具合をそのまま速さにする。キーボードの斜めやスティックの角は長さが1を超えるので1に抑える
            const dir = vec(
                input.getValue("right") - input.getValue("left"),
                input.getValue("down") - input.getValue("up"),
            )
            if (dir.magnitude() === 0) {
                this.v = vec(0, 0)
            } else if (this.boostSpeed !== undefined) {
                // ブースト中は倒し具合も低速入力も無視し、向きだけ使って定値の速さで動く
                this.v = dir.normalize().scale(this.boostSpeed)
            } else {
                this.v = (dir.magnitude() > 1 ? dir.normalize() : dir).scale(
                    input.isPressed("slow") ? this.slowSpeed : this.speed,
                )
            }
        }

        if (this.v.magnitude() === 0) return

        this.drag(this.v)

        this.emitMoveParticles()
    }

    // 自機を v だけ動かす。ステージの吸い込みや流れからも呼ばれる。画面の外へは出さない
    drag(v: Vec) {
        const next = this.p.add(v)

        this.p = vec(Math.min(Math.max(next.x, 0), this.game.WIDTH), Math.min(Math.max(next.y, 0), this.game.HEIGHT))
    }

    // 移動中、自機の周り(横GRAZE_R*16 × 縦GRAZE_R*4の範囲)に三角形の粒子を撒く。ブースト中は2つずつ、速く・長く残す
    private emitMoveParticles() {
        const isBoosted = this.isBoosted()

        for (let i = 0; i < (isBoosted ? 2 : 1); i++) {
            this.scripts.add(() =>
                TriangleParticle.drift(
                    this.game,
                    this.p.add(vec((Math.random() - 0.5) * this.GRAZE_R * 8, (Math.random() - 0.5) * this.GRAZE_R * 4)),
                    vec((Math.random() - 0.5) * (isBoosted ? 8 : 4), (Math.random() - 0.5) * (isBoosted ? 8 : 4)),
                    isBoosted ? 30 : 20,
                ),
            )
        }
    }
}
