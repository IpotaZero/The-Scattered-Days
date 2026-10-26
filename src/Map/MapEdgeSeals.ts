import { PlayerData } from "../Data/PlayerData"
import type { MapGraph } from "./MapGraph"
import type { MapSight } from "./MapSight"

// 並べる印どうしの間隔(ワールド座標px)
const SEAL_SPACING = 36

// 辺のfromのノードの外接円から、最初の印までの距離(ワールド座標px)。選ばれて少し大きくなったノードや、その角の星に重ならないだけ離す
const SEAL_MARGIN = 60

// 条件のある辺に、その条件の印(EdgeCondition.seals)を数珠のように通す。
// 針が条件の辺には、その針の印を一つ。すべての免状が条件の辺(最後の場所への関所)には、免状を授ける場所ごとの印を並べる。
// 満たした印は塗り、まだのものは輪だけにする。まだ行けない場所にかかわる印は、ノードと同じく絵柄を伏せる
export class MapEdgeSeals {
    readonly el = document.createElement("div")

    constructor(
        private readonly graph: MapGraph,
        private readonly sight: MapSight,
        private readonly playerData: PlayerData,
    ) {
        this.el.className = "map-edge-seals"
        this.refresh()
    }

    // 印をすべて並べ直す。地図に見せている解放の様子(sight)が変わったら呼ぶ
    refresh(): void {
        this.el.replaceChildren()

        for (const edge of this.graph.edges) {
            // 辺の手前側(fromのノードのすぐ外)から、辺に沿って並べる。fromを選んだときに画面の中に収まるようにする
            const len = Math.hypot(edge.to.x - edge.from.x, edge.to.y - edge.from.y) || 1
            const start = Math.hypot(edge.from.width, edge.from.height) / 2 + SEAL_MARGIN

            edge.condition.seals(edge.from, this.sight, this.playerData).forEach((seal, i) => {
                const offset = start + i * SEAL_SPACING

                const el = document.createElement("div")
                el.className = `map-edge-seal ${edge.condition.name}`
                el.classList.toggle("earned", seal.earned)
                el.classList.toggle("locked", seal.locked)
                el.style.left = `${edge.from.x + ((edge.to.x - edge.from.x) / len) * offset}px`
                el.style.top = `${edge.from.y + ((edge.to.y - edge.from.y) / len) * offset}px`
                el.innerHTML = `<svg class="map-node-motif" viewBox="-12 -12 24 24">${seal.motif}</svg>`
                this.el.appendChild(el)
            })
        }
    }
}
