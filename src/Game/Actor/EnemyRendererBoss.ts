import { Enemy } from "./Enemy"
import { IEnemyRenderer } from "./IEnemyRenderer"
import { DeathEffect } from "./DeathEffect"
import { Ctx } from "../../utils/Functions/Ctx"
import { vec } from "@ipota/vec"
import { T } from "../../T"

const WHITE = "#ffffff80"
const IVORY = "rgba(240, 230, 205, 0.4)"
const GOLD = "rgba(220, 190, 110, 0.5)"
const RED = "rgba(255, 60, 60, 0.6)"
const CYAN = "rgba(0, 255, 255, 0.4)"
const BLACK_VALE = "rgba(255, 255, 255, 0.2)"
const BLUE = "rgba(60, 140, 255, 0.8)"
const CHARGE_FILL = "rgba(140, 200, 255, 0.95)"
const HITBOX_FILL = "rgba(255, 255, 255, 0.06)"
const HITBOX_EDGE = "rgba(255, 255, 255, 0.75)"

export class EnemyRendererBoss implements IEnemyRenderer {
    *onDead(e: Enemy) {
        yield* DeathEffect.bossDefeat(e)
    }

    draw(ctx: CanvasRenderingContext2D, e: Enemy): void {
        const orbitTheta = e.frame / 180
        const pulse = Math.sin(e.frame / 40) * 0.03

        this.drawBossHpBar(ctx, e)
        this.drawMagicCircle(ctx, e, orbitTheta, pulse)
        this.drawMiddleFrame(ctx, e, orbitTheta)

        this.drawCoreComplex(ctx, e, orbitTheta, pulse)

        this.drawBits(ctx, e, orbitTheta)
        this.drawHitBox(ctx, e, pulse)
    }

    /**
     * 上部に大きく表示されるボス専用HPゲージ。
     * 充電中はHPバーの代わりに、青い充電進捗バーを表示する。
     */
    private drawBossHpBar(ctx: CanvasRenderingContext2D, e: Enemy): void {
        const width = e.game.WIDTH * 0.8
        const height = 24
        // ワールド座標は左上原点の [0, WIDTH] x [0, HEIGHT]
        const x = (e.game.WIDTH - width) / 2
        const y = 30

        ctx.save()
        ctx.translate(0, y)

        // 外枠と背景（共通）
        Ctx.rect(ctx, { x, y: 0 }, vec(width, height), "rgba(255, 255, 255, 0.1)", {
            lineWidth: 2,
        })

        if (e.battery.isCharging()) {
            // 充電中：充電進捗バーのみ表示
            const chargeRatio = e.battery.ratio()

            Ctx.rect(ctx, { x, y: 0 }, vec(width * chargeRatio, height), CHARGE_FILL)
            Ctx.rect(ctx, { x, y: height * 0.7 }, vec(width * chargeRatio, height * 0.3), "rgba(255, 255, 255, 0.3)")

            for (let i = 0; i <= 10; i++) {
                const mx = x + (width / 10) * i
                ctx.strokeStyle = BLUE
                ctx.beginPath()
                ctx.moveTo(mx, -4)
                ctx.lineTo(mx, height + 4)
                ctx.stroke()
            }
        } else {
            // 通常時：HPバーを表示
            const hpRatio = e.life / e.maxLife
            const color = e.damaged || e.isInvincible ? RED : CYAN

            Ctx.rect(ctx, { x, y: 0 }, vec(width * hpRatio, height), color)
            Ctx.rect(ctx, { x, y: height * 0.7 }, vec(width * hpRatio, height * 0.3), "rgba(255, 255, 255, 0.3)")

            for (let i = 0; i <= 10; i++) {
                const mx = x + (width / 10) * i
                ctx.strokeStyle = WHITE
                ctx.beginPath()
                ctx.moveTo(mx, -4)
                ctx.lineTo(mx, height + 4)
                ctx.stroke()
            }
        }

        ctx.restore()
    }

    /**
     * 同じ向きにゆっくり回る二重の輪。外側の輪にだけ短い刻み目が並ぶ
     */
    private drawMagicCircle(ctx: CanvasRenderingContext2D, e: Enemy, theta: number, pulse: number): void {
        Ctx.arc(ctx, e.p, e.r * 1.6 * (1 + pulse), IVORY, { lineWidth: 1 })

        const outer = e.r * 2.2 * (1 + pulse * 2)
        Ctx.arc(ctx, e.p, outer, GOLD, { lineWidth: 1 })

        for (let i = 0; i < 24; i++) {
            const angle = (i * T) / 24 + theta * 0.5
            const p1 = e.p.add(vec(outer, 0).rotate(angle))
            const p2 = e.p.add(vec(outer + 6, 0).rotate(angle))

            ctx.strokeStyle = GOLD
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
        }
    }

    private drawMiddleFrame(ctx: CanvasRenderingContext2D, e: Enemy, theta: number): void {
        Ctx.polygon(ctx, 8, 1, e.p, e.r * 2, BLACK_VALE, {
            theta: theta * 0.5,
            lineWidth: 2,
        })
    }

    /**
     * 輪になって並び、頂点を外へ向けたまま周りをゆっくり回る菱形
     */
    private drawBits(ctx: CanvasRenderingContext2D, e: Enemy, theta: number): void {
        const bitCount = 6

        for (let i = 0; i < bitCount; i++) {
            const angle = (i * T) / bitCount + theta * 0.5
            const bitPos = e.p.add(vec.arg(angle).scale(e.r * 3))

            Ctx.polygon(ctx, 4, 1, bitPos, e.r / 3, IVORY, {
                theta: angle,
                lineWidth: 1,
            })
        }
    }

    /**
     * 中心部の幾何学構造。星形の多角形が互いに逆向きにゆっくり回る
     */
    private drawCoreComplex(ctx: CanvasRenderingContext2D, e: Enemy, theta: number, pulse: number): void {
        const coreColor = e.damaged ? RED : WHITE

        Ctx.polygon(ctx, 13, 2, e.p, e.r * (0.9 + pulse), coreColor, {
            theta: theta,
            lineWidth: 2,
        })
        Ctx.polygon(ctx, 11, 2, e.p, e.r * (0.9 - pulse), coreColor, {
            theta: -theta,
            lineWidth: 1,
        })

        Ctx.arc(ctx, e.p, e.r * 0.7, WHITE, { lineWidth: 1 })
        Ctx.arc(ctx, e.p, e.r * 0.5, WHITE, { lineWidth: 1 })

        Ctx.polygon(ctx, 7, 2, e.p, e.r * (0.6 + pulse), coreColor, {
            theta: theta,
            lineWidth: 1,
        })
    }

    /**
     * 実際の当たり判定 (e.r) を示す円を描画
     */
    private drawHitBox(ctx: CanvasRenderingContext2D, e: Enemy, pulse: number): void {
        // 内側をうっすら塗り、周りの線の装飾と区別できる「面」にする
        Ctx.arc(ctx, e.p, e.r, HITBOX_FILL)
        // 縁は他のどの線よりも少しだけ太く明るくする
        Ctx.arc(ctx, e.p, e.r, HITBOX_EDGE, { lineWidth: 3 })
        // 鼓動するリングは縁の内側だけで動かし、当たり判定の外へはみ出させない
        Ctx.arc(ctx, e.p, e.r * (0.95 + pulse), WHITE, { lineWidth: 1 })
    }
}
