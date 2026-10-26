import { EquipmentId } from "../Data/Equipment"
import { PlayerData } from "../Data/PlayerData"
import { mainEquipments, type MainEquipment } from "../Game/Equipment/PlayerEquipment"
// MapGraphとは互いに参照し合うので、型としてだけ読み込む
import type { MapNode } from "./MapGraph"
import type { MapSight } from "./MapSight"

// 辺に数珠のように通す印の一つ(MapEdgeSeals)
export type EdgeSeal = {
    // 丸の中に描く絵柄(viewBox="-12 -12 24 24"のSVGの中身)
    readonly motif: string
    // 満たしていれば塗る
    readonly earned: boolean
    // まだ行けない場所にかかわる印は、絵柄を伏せる
    readonly locked: boolean
}

// 辺を通ってtoが解放されるための、fromのクリアに上乗せされる条件。Canvasの辺のラベルから作る
export abstract class EdgeCondition {
    // 辺の見た目の区別(CSSクラス)に使う名前。条件がなければundefined
    abstract readonly name?: string

    abstract isMet(from: MapNode, playerData: PlayerData): boolean

    // 辺のfrom側から順に並べる印。行けるかどうかは、地図に見せている解放の様子(sight)に合わせる
    abstract seals(from: MapNode, sight: MapSight, playerData: PlayerData): EdgeSeal[]

    // ラベルなし: 追加の条件なし / "badges": 全免状 / それ以外: 主装備のID
    static fromLabel(label: string | undefined, masters: readonly MapNode[]): EdgeCondition {
        if (!label) return new NoCondition()
        if (label === AllBadgesCondition.LABEL) return new AllBadgesCondition(masters)
        return new MainEquipmentCondition(label)
    }
}

class NoCondition extends EdgeCondition {
    readonly name = undefined

    isMet(): boolean {
        return true
    }

    seals(): EdgeSeal[] {
        return []
    }
}

// fromをこの主装備でクリアしていること
class MainEquipmentCondition extends EdgeCondition {
    private readonly equipment: MainEquipment

    constructor(readonly name: EquipmentId) {
        super()
        const equipment = mainEquipments[name]
        // ラベルに当たる主装備がなければ、地図を読み込んだ時点で止める
        if (!equipment) throw new Error(`辺のラベル"${name}"に当たる主装備がありません`)
        this.equipment = equipment
    }

    isMet(from: MapNode, playerData: PlayerData): boolean {
        return playerData.getStageClearedMainEquipments(from.id).has(this.name)
    }

    // 辺の根元に、その針の印を一つ置く。fromをその針でクリアすれば塗る。fromにまだ行けなければ伏せる
    seals(from: MapNode, sight: MapSight, playerData: PlayerData): EdgeSeal[] {
        return [
            {
                motif: this.equipment.icon.content,
                earned: this.isMet(from, playerData),
                locked: !sight.isUnlocked(from),
            },
        ]
    }
}

// マップ上のすべての免状を持っていること
class AllBadgesCondition extends EdgeCondition {
    static readonly LABEL = "badges"
    readonly name = AllBadgesCondition.LABEL

    // 免状を授けるノード(道場主)。地図と同じく季節の順(左から右)に並べておく
    private readonly masters: readonly MapNode[]

    constructor(masters: readonly MapNode[]) {
        super()
        // 免状を授けるノードが1つもなければ、書き忘れか書き間違いなので読み込み時点で気づけるようにする
        if (masters.length === 0) throw new Error(`辺に"${AllBadgesCondition.LABEL}"がありますが、免状を授けるノードがありません`)
        this.masters = [...masters].sort((a, b) => a.x - b.x)
    }

    isMet(_from: MapNode, playerData: PlayerData): boolean {
        return this.masters.every((master) => playerData.hasBadge(master.badge!))
    }

    // 道場主ごとに、その場所の絵柄の印を一つ。授かった免状は塗る。まだ行けない場所の絵柄は伏せる
    seals(_from: MapNode, sight: MapSight, playerData: PlayerData): EdgeSeal[] {
        return this.masters.map((master) => ({
            motif: master.scenery.motif.content,
            earned: playerData.hasBadge(master.badge!),
            locked: !sight.isUnlocked(master),
        }))
    }
}
