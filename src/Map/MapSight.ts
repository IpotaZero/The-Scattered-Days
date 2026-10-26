import type { PlayerData } from "../Data/PlayerData"
import type { MapEdge, MapGraph, MapNode } from "./MapGraph"

// 地図に描く解放の様子。開いた辺も、解放の演出で見せる(show)までは開いていないものとして描き、その先のノードも行けないものとして描く。
// 見せた辺はアプリを開いている間だけ覚えておき(セーブデータには入らない)、次に地図を開いたときに引き継ぐ
export class MapSight {
    // 最後に開いた地図で見せた辺
    private static lastShown?: ReadonlySet<MapEdge>

    // 開いている辺
    private readonly passable: readonly MapEdge[]
    // 見せた辺。lastShownと同じものを指し、見せるたびに両方へ加わる
    private readonly shown: Set<MapEdge>

    constructor(
        private readonly graph: MapGraph,
        playerData: PlayerData,
    ) {
        this.passable = graph.edges.filter((edge) => graph.isPassable(edge, playerData))

        // アプリを開いて初めての地図と、デバッグ用の全解放中は、開いている辺をすべて見せたことにする。
        // 前に見せた辺でも、いま閉じているもの(データを消したときなど)は外し、また開いたときに演出する
        const last = MapSight.lastShown
        this.shown = new Set(
            !last || playerData.debugMode ? this.passable : this.passable.filter((edge) => last.has(edge)),
        )
        MapSight.lastShown = this.shown
    }

    isPassable(edge: MapEdge): boolean {
        return this.shown.has(edge)
    }

    isUnlocked(node: MapNode): boolean {
        return this.graph.isReached(node, (edge) => this.isPassable(edge))
    }

    // 開いているのに、まだ見せていない辺
    unseen(): MapEdge[] {
        return this.passable.filter((edge) => !this.shown.has(edge))
    }

    show(edge: MapEdge) {
        this.shown.add(edge)
    }
}
