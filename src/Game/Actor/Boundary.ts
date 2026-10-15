import type { Vec } from "@ipota/vec"
import type { Bullet } from "./Bullet"

// 弾が場所によって消えるかどうか。全弾がどれか一つを必ず持ち、Bullet.update で毎フレーム確かめる
export namespace Boundary {
    export type Type = { isOut(me: Bullet): boolean }

    // 半径ぶん画面の外へ出たら消える
    export const screen: Type = {
        isOut(me) {
            return (
                me.p.x < -me.r || me.game.WIDTH + me.r < me.p.x || me.p.y < -me.r || me.game.HEIGHT + me.r < me.p.y
            )
        },
    }

    // 場所では消えない。消すのは g などの側で行う
    export const none: Type = {
        isOut() {
            return false
        },
    }

    // center から distance より半径ぶん遠く離れたら消える
    export class FarFrom implements Type {
        constructor(
            readonly center: Vec,
            readonly distance: number,
        ) {}

        isOut(me: Bullet) {
            const dx = me.p.x - this.center.x
            const dy = me.p.y - this.center.y
            return dx * dx + dy * dy > (this.distance + me.r) ** 2
        }
    }
}
