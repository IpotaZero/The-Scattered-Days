import { playerData } from "../Data/PlayerData"
import { MapEdge, MapGraph, MapNodeId } from "./MapGraph"
import type { MapSight } from "./MapSight"

// 地図の辺(SVGの線)と、ノードのDOM要素を描く。選択中のノードの枠もここで切り替える。
// 行けないノードと通れない辺は、地図に見せている解放の様子(sight)で決める
export class MapNodeViews {
    private readonly elements = new Map<MapNodeId, HTMLElement>()
    private readonly lines = new Map<MapEdge, SVGLineElement[]>()

    constructor(
        private readonly graph: MapGraph,
        private readonly sight: MapSight,
        edgesEl: SVGSVGElement,
        container: HTMLElement,
        onTap: (id: MapNodeId) => void,
    ) {
        for (const edge of graph.edges) {
            const lines = MapNodeViews.createLines(edge)
            edgesEl.append(...lines)
            this.lines.set(edge, lines)
        }

        for (const node of graph.nodes) {
            const el = document.createElement("div")
            // ノードには文字の代わりに、その場所の景色の絵柄を描く。まだ行けない場所の絵柄は伏せておく(css)
            el.className = `map-node scenery-${node.scenery.id}`
            el.innerHTML = `<svg class="map-node-motif" viewBox="-12 -12 24 24">${node.scenery.motif.content}</svg>`
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

        this.refresh()
    }

    select(id: MapNodeId): void {
        this.elements.forEach((el, nodeId) => el.classList.toggle("selected", nodeId === id))
    }

    // 行けないノードと通れない辺を、sightに合わせてすぐに描き直す
    refresh(): void {
        for (const node of this.graph.nodes) {
            this.elements.get(node.id)!.classList.toggle("locked", !this.sight.isUnlocked(node))
        }
        this.lines.forEach((lines, edge) => {
            for (const line of lines) line.classList.toggle("locked", !this.sight.isPassable(edge))
        })
    }

    // edgeの線だけを、durationMSかけてsightに合わせた濃さへ移す
    fadeEdge(edge: MapEdge, durationMS: number): void {
        for (const line of this.lines.get(edge)!) {
            line.style.transition = `opacity ${durationMS}ms ease-in-out`
            line.classList.toggle("locked", !this.sight.isPassable(edge))
        }
    }

    private static createLines(edge: MapEdge): SVGLineElement[] {
        const { from, to } = edge
        const line = (offset: { x: number; y: number }) => {
            const el = document.createElementNS("http://www.w3.org/2000/svg", "line")
            if (edge.condition.name) el.classList.add(edge.condition.name)
            el.setAttribute("x1", `${from.x + offset.x}`)
            el.setAttribute("y1", `${from.y + offset.y}`)
            el.setAttribute("x2", `${to.x + offset.x}`)
            el.setAttribute("y2", `${to.y + offset.y}`)
            return el
        }

        // laserの条件は二重線で表す。辺に垂直な方向へ左右にずらした2本の線を引く
        if (edge.condition.name === "laser") {
            const len = Math.hypot(to.x - from.x, to.y - from.y) || 1
            const gap = 3
            const normal = { x: (-(to.y - from.y) / len) * gap, y: ((to.x - from.x) / len) * gap }
            return [line(normal), line({ x: -normal.x, y: -normal.y })]
        }

        return [line({ x: 0, y: 0 })]
    }
}
