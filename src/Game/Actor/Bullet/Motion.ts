import type { Bullet } from "./Bullet"

// 弾の進み方。全弾がどれか一つを必ず持ち、Bullet.update で毎フレーム一歩ずつ進める
export namespace Motion {
    export type Type = { step(me: Bullet): void }

    // radian の向きへ speed だけ進む
    export const straight: Type = {
        step(me) {
            me.p.x += Math.cos(me.radian) * me.speed
            me.p.y += Math.sin(me.radian) * me.speed
        },
    }

    // 自分では動かない。位置は g などの側で書き換える
    export const still: Type = {
        step() {},
    }

    // 自機の方へ向きを変え、自機から遠いほど速く進む
    export const homing: Type = {
        step(me) {
            const diff = me.game.player.p.sub(me.p)

            me.radian = diff.radian()
            me.speed = Math.max(diff.magnitude() / 12, 16)

            straight.step(me)
        },
    }
}
