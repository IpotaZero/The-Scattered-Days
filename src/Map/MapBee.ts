import { Silhouette } from "../utils/Silhouette"
import type { MainEquipment } from "../Game/Equipment/PlayerEquipment"
import type { MapNode } from "./MapGraph"

// 地図の上の自機(蜂)。選んだノードへ飛んでいき、その上にとまる。
// 文字の説明の代わりに、いま自分がどこにいるのかを、地図の上にいる自分の姿で示す。
// 尾の先には、いま装備している針の印(辺に通す印と同じ形)を提げる
export class MapBee {
    readonly el = document.createElement("div")
    private readonly needleEl: HTMLElement

    // いまとまっているノードの位置。次に飛ぶ向きを決めるのに使う
    private x: number

    constructor(node: MapNode, needle: MainEquipment) {
        this.el.className = "map-bee"
        this.el.innerHTML = `
            <div class="map-bee-body">
                <svg viewBox="-14 -14 28 28" fill="currentColor">${Silhouette.bugs.bee.content}</svg>
                <div class="map-bee-needle map-edge-seal earned"></div>
            </div>`
        this.needleEl = this.el.querySelector<HTMLElement>(".map-bee-needle")!
        this.wield(needle)

        this.x = node.x
        this.el.style.left = `${node.x}px`
        this.el.style.top = `${node.y - node.height / 2}px`
    }

    // node の上へ飛ぶ。左へ飛ぶときは左を向く(カメラと同じ速さで移るので、画面の中ではほとんど動かずに羽ばたいて見える)
    flyTo(node: MapNode) {
        if (node.x !== this.x) this.el.classList.toggle("facing-left", node.x < this.x)

        this.x = node.x
        this.el.style.left = `${node.x}px`
        this.el.style.top = `${node.y - node.height / 2}px`
    }

    // 尾の先の印を、needleの印に替える
    wield(needle: MainEquipment) {
        this.needleEl.innerHTML = `<svg class="map-node-motif" viewBox="-12 -12 24 24">${needle.icon.content}</svg>`
    }
}
