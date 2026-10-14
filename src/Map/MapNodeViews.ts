import { playerData } from "../Data/PlayerData"
import { MapEdge, MapGraph, MapNodeId } from "./MapGraph"

// 地図の辺(SVGの線)と、ノードのDOM要素を描く。選択中のノードの枠もここで切り替える
export class MapNodeViews {
    private readonly elements = new Map<MapNodeId, HTMLElement>()

    constructor(
        graph: MapGraph,
        container: HTMLElement,
        onTap: (id: MapNodeId) => void,
    ) {
        for (const node of graph.nodes) {
            const el = document.createElement("div")
            // ノードには文字の代わりに、その場所の景色の絵柄を描く。まだ行けない場所の絵柄は伏せておく(css)
            el.className = `map-node scenery-${node.scenery.id}`
            el.innerHTML = `<svg class="map-node-motif" viewBox="-12 -12 24 24">${node.scenery.motif.content}</svg>`
            el.classList.toggle("locked", !graph.isUnlocked(node, playerData))
            // クリア済みなら銀の星、ノーミスでクリア済みなら金の星を付ける
            el.classList.toggle("cleared", playerData.isStageCleared(node.id))
            el.classList.toggle("no-miss", playerData.isStageClearedWithoutMiss(node.id))
            el.style.left = `${node.x}px`
            el.style.top = `${node.y}px`
            el.style.width = `${node.width}px`
            el.style.height = `${node.height}px`
            el.addEventListener("click", () => onTap(node.id))

            container.appendChild(el)
            this.elements.set(node.id, el)
        }
    }

    select(id: MapNodeId): void {
        this.elements.forEach((el, nodeId) => el.classList.toggle("selected", nodeId === id))
    }

    static renderEdges(graph: MapGraph): string {
        return graph.edges.map((edge) => MapNodeViews.renderEdge(graph, edge)).join("")
    }

    private static renderEdge(graph: MapGraph, edge: MapEdge): string {
        const { from, to } = edge
        const locked = !graph.isPassable(edge, playerData)
        const className = [locked ? "locked" : "", edge.condition.name ?? ""].join(" ")
        const line = (offset: { x: number; y: number }) =>
            `<line class="${className}" x1="${from.x + offset.x}" y1="${from.y + offset.y}" x2="${to.x + offset.x}" y2="${to.y + offset.y}" />`

        // laserの条件は二重線で表す。辺に垂直な方向へ左右にずらした2本の線を引く
        if (edge.condition.name === "laser") {
            const len = Math.hypot(to.x - from.x, to.y - from.y) || 1
            const gap = 3
            const normal = { x: (-(to.y - from.y) / len) * gap, y: ((to.x - from.x) / len) * gap }
            return line(normal) + line({ x: -normal.x, y: -normal.y })
        }

        return line({ x: 0, y: 0 })
    }
}
