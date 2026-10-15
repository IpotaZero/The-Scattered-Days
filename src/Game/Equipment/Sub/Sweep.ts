import { Ease } from "@ipota/functions"
import { vec } from "@ipota/vec"
import type { Player } from "../../Actor/Player"
import { actionCooldown } from "../ActionCooldown"
import { SweepBell } from "./SweepBell"
import type { SubEquipment } from "../types"

// 一掃は「盤面を白紙に戻す」装備。
// 画面の弾をすべて花粉に変えるかわりに、次に使えるまでがとても長い。
// どの提示で切るかを選ぶことが、この技の遊びになる。
const ためフレーム = 2
const 閃光フレーム = 20
const 広がりフレーム = 60
const 余韻フレーム = 80
const クールダウンフレーム = 900

export const sweep: SubEquipment = {
    label: "一掃",
    description: "自機から波を広げ、画面の敵弾をすべて花粉に変える。",
    price: 10000,
    manual: true,
    *action(player) {
        while (true) {
            if (player.game.input.isPushed("action")) {
                player.scripts.add(() => sweepWave(player))
                yield* actionCooldown(player, クールダウンフレーム)
            }

            yield
        }
    },
}

// 使うと、ためのあいだは弾に何もせず、自機のまわりで輪が縮む(自機は動ける)。
// ためが終わった瞬間、画面全体が一瞬光り、その自機の位置から波が広がって、画面のいちばん遠い角まで届く。
// 届いたあとは弾に何もせず、見た目(SweepBell)だけが余韻のぶん続く
function* sweepWave(player: Player): Generator<void, void, void> {
    const { WIDTH, HEIGHT } = player.game

    for (let i = 1; i <= ためフレーム; i++) {
        const at = player.p.clone()
        player.game.drawInWorld((ctx) => SweepBell.gather(ctx, at, i / ためフレーム))
        yield
    }

    const center = player.p.clone()
    const far = Math.max(
        ...[vec(0, 0), vec(WIDTH, 0), vec(0, HEIGHT), vec(WIDTH, HEIGHT)].map((c) => c.sub(center).magnitude()),
    )

    player.game.camera.shake(8, 8)
    player.game.se.bomb.play()

    for (let i = 1; i <= 広がりフレーム + 余韻フレーム; i++) {
        const radius = Ease.Out(Math.min(i, 広がりフレーム) / 広がりフレーム) * far

        if (i <= 広がりフレーム) {
            // 毎フレーム全弾を見るので、filterで配列を作らずに一度で振り分ける(GC対策)
            player.game.bullets.forEach((b) => {
                if (b.type !== "enemy" && b.type !== "neutral") return
                if (!b.isScorable) return
                if ((b.p.x - center.x) ** 2 + (b.p.y - center.y) ** 2 > radius ** 2) return

                b.scorenize()
            })
        }

        if (i <= 閃光フレーム) {
            player.game.drawInWorld((ctx) => SweepBell.flash(ctx, WIDTH, HEIGHT, (i - 1) / 閃光フレーム))
        }

        player.game.drawInWorld((ctx) => SweepBell.draw(ctx, center, far, radius, i / 広がりフレーム))

        yield
    }
}
