import { Awaits } from "@ipota/functions"
import { App } from "../App"
import { Dom } from "../Dom"
import { playerData } from "../Data/PlayerData"
import { mainEquipments, type MainEquipment } from "../Game/Equipment/PlayerEquipment"
import { MapEdge, MapGraph, MapNode, MapNodeId } from "../Map/MapGraph"
import { MapEquipMenu } from "../Map/MapEquipMenu"
import { MapHud } from "../Map/MapHud"
import { MapNavigation, type Direction } from "../Map/MapNavigation"
import { MapNodeViews } from "../Map/MapNodeViews"
import { MapMinimap } from "../Map/MapMinimap"
import { MapBee } from "../Map/MapBee"
import { MapEdgeSeals } from "../Map/MapEdgeSeals"
import { MapCamera } from "../Map/MapCamera"
import { MapProps } from "../Map/MapProps"
import { MapSight } from "../Map/MapSight"
import { InputCode } from "../utils/InputCode"
import { isSmartPhone } from "../utils/Functions/isSmartPhone"
import { shakeElement } from "../utils/Functions/shakeElement"
import { Scene } from "../utils/Scene/Scene"
import { SvgFile } from "../utils/SvgFile"
import type { Scenery } from "../World/Scenery"
import { Language } from "../Data/Language"

// 全体図・型と残機の画面を閉じるときのフェードアウトにかける時間
const OVERLAY_FADE_OUT_MS = 200

// 別の景色の塊へ入ったときの、曲のクロスフェードにかける秒数
const AREA_BGM_CROSSFADE_SECONDS = 1

// 曲が切り替わったときに、右上へ曲名を出しておく時間(ms)
const BGM_TITLE_MS = 5000

// 解放の演出で、カメラを開いた辺の先のノードへ運ぶ(その間に線を濃くする)のと、選んでいるノードへ戻すのにかける時間
const UNLOCK_PAN_MS = 1000

// 解放の演出の一拍。地図が現れてから演出を始めるまでと、カメラが着いてから光らせるまでに置く
const UNLOCK_BEAT_MS = 200

// 解放の演出で、画面を光らせて揺らす時間。光が消えてから次へ移る
const UNLOCK_FLASH_MS = 600

// 解放の演出で、画面を揺らす大きさ(px)
const UNLOCK_SHAKE_PX = 12

export class SceneMap extends Scene {
    private selectedId: MapNodeId
    private nodeViews!: MapNodeViews
    private camera!: MapCamera
    // 地図の上の自分(蜂)。選んだノードへ飛んでいく
    private bee!: MapBee
    private hud!: MapHud
    private equipMenu?: MapEquipMenu
    private minimap?: MapMinimap
    // 曲を切り替え済みの景色。選んだノードの景色がこれと違ったら、その景色の曲へクロスフェードする
    private bgmScenery?: Scenery
    // 最後に鳴らすよう頼んだ曲。クロスフェードの途中でも、頼んだ曲を指す
    private requestedBgmSrc?: string
    // 右上に出ている曲名
    private bgmTitleEl?: HTMLElement
    // 地図に描く解放の様子。前に地図を開いていたときの後で開いた辺は、解放の演出で見せるまで伏せておく
    private readonly sight: MapSight
    private props!: MapProps
    private seals!: MapEdgeSeals
    // 解放の演出の間はtrue。操作を受け付けない
    private unlocking = false

    private constructor(private readonly graph: MapGraph) {
        super()
        // 前回いたノードから始める。マップの変更で消えた/未解放になったノードならスタート地点に戻す
        const saved = graph.nodes.find((node) => node.id === playerData.mapNodeId)
        this.selectedId = saved && graph.isUnlocked(saved, playerData) ? saved.id : graph.start.id
        this.sight = new MapSight(graph, playerData)
    }

    // マップと、ノードの絵柄・小物・蜂のSVGの取得を待ってから生成する
    static async create(): Promise<SceneMap> {
        const [graph] = await Promise.all([MapGraph.load(), SvgFile.loadAll()])
        return new SceneMap(graph)
    }

    protected async onStart(): Promise<void> {
        console.log(`SceneMap: ${this.selectedId}`)

        this.root.classList.add("scene-map", "paper-scene")
        this.root.innerHTML = `
            <div class="map-camera">
                <div class="map-seasons map-backdrop"></div>
                <div class="map-grid map-backdrop"></div>
                <div class="map-world">
                    <svg class="map-edges"></svg>
                    <div class="map-nodes"></div>
                </div>
                <div class="texture-overlay map-backdrop"></div>
            </div>
            <div class="map-lives">
                <div class="map-lives-count"></div>
                <div class="map-lives-recovery"></div>
                <div class="map-score"></div>
                <div class="map-achievement"></div>
            </div>
            <div class="map-controls">
                ${isSmartPhone ? "" : `<div data-control="toggle-minimap"><span class="nowrap">${Language.text("map")}</span>${isSmartPhone ? `` : `(${InputCode.primaryLabel(App.settings.keyConfig.slow)})`}</div>`}
                <div data-control="open-equip"><span class="nowrap">${Language.text("changeType")}</span>${isSmartPhone ? `` : `(${InputCode.primaryLabel(App.settings.keyConfig.action)})`}</div>
                <div data-control="back-to-title"><span class="nowrap">${Language.text("title")}</span>${isSmartPhone ? `` : `(${InputCode.primaryLabel(App.settings.keyConfig.cancel)})`}</div>
            </div>
        `

        const cameraEl = this.root.querySelector<HTMLElement>(".map-camera")!
        if (isSmartPhone) {
            // スマホは背景3枚をカメラの外に出し、画面に固定する。背景はカメラと一緒には動かなくなる(map.cssの.fixed-backdrop)。
            // カメラの中に入れると、世界の広さ×縮小ぶんの巨大なレイヤーになり、メモリを食う
            this.root.classList.add("fixed-backdrop")
            cameraEl.before(...Array.from(cameraEl.querySelectorAll(".map-seasons, .map-grid")))
            cameraEl.after(...Array.from(cameraEl.querySelectorAll(".texture-overlay")))
        }

        // スマホは全体図のボタンを置かない代わりに、ピンチで縮めて広く見渡せるようにする。
        // 縮めるほど一度に描く範囲が広がってメモリを食うので、縮めすぎないようにする
        this.camera = new MapCamera(
            this.root,
            cameraEl,
            this.graph.bounds(),
            isSmartPhone ? { min: 0.6, max: 2 } : { min: 1, max: 1 },
            () => !this.equipMenu && !this.minimap,
        )

        const nodesEl = this.root.querySelector<HTMLElement>(".map-nodes")!
        // 塊のまわりの小物は、辺より手前・ノードより奥に置く
        this.props = new MapProps(this.graph, this.sight)
        nodesEl.before(this.props.el)
        // 条件のある辺には、条件の印を辺より手前・ノードより奥に並べる
        this.seals = new MapEdgeSeals(this.graph, this.sight, playerData)
        nodesEl.before(this.seals.el)
        this.nodeViews = new MapNodeViews(
            this.graph,
            this.sight,
            this.root.querySelector<SVGSVGElement>(".map-edges")!,
            nodesEl,
            (id) => {
                // スワイプ・ピンチの指を離した直後に発火するclickをタップ選択として扱わない
                if (this.camera.dragged) return
                this.handleNodeTap(id)
            },
        )
        // 初期選択ノードにも見た目上selectedを反映しておく(そうしないと最初の移動まで枠が出ない)
        this.nodeViews.select(this.selectedId)

        this.root.querySelector<HTMLElement>('[data-control="back-to-title"]')?.addEventListener("click", () => {
            if (this.equipMenu) return
            App.sc.goto(async () => import("./SceneTitle").then(({ SceneTitle }) => new SceneTitle()))
        })
        this.root.querySelector<HTMLElement>('[data-control="toggle-minimap"]')?.addEventListener("click", () => {
            if (this.equipMenu) return
            this.toggleMinimap()
        })
        this.root.querySelector<HTMLElement>('[data-control="open-equip"]')?.addEventListener("click", () => {
            if (this.equipMenu) return
            this.openEquipMenu()
        })

        this.bee = new MapBee(this.graph.node(this.selectedId), this.wieldedNeedle())
        this.root.querySelector(".map-world")!.appendChild(this.bee.el)

        this.hud = new MapHud(this.root.querySelector<HTMLElement>(".map-lives")!, this.graph)

        // 初期カメラは選択中ノードを中央に据えた状態から始める(アニメーションなし)
        this.camera.lookAt(this.graph.node(this.selectedId), false)
        this.tintSeason(this.graph.node(this.selectedId))

        this.crossfadeToSceneryBgm()
        this.showUnlocks()
    }

    protected async onEnd(): Promise<void> {}

    update(): void {
        playerData.recoverLivesOverTime()
        this.hud.updateLives()

        if (this.unlocking) return

        if (this.equipMenu) {
            this.equipMenu.update()
            return
        }

        if (App.input.isRepeatPushed("up", 100, 300)) {
            this.move("up")
        } else if (App.input.isRepeatPushed("down", 100, 300)) {
            this.move("down")
        } else if (App.input.isRepeatPushed("left", 100, 300)) {
            this.move("left")
        } else if (App.input.isRepeatPushed("right", 100, 300)) {
            this.move("right")
        } else if (App.input.isPushed("slow")) {
            this.toggleMinimap()
        } else if (App.input.isPushed("ok")) {
            this.select()
        } else if (App.input.isPushed("action")) {
            // 装備画面からミニマップへ行けないのに合わせ、ミニマップからも装備画面へは行けないようにする
            if (this.minimap) return
            this.openEquipMenu()
        } else if (App.input.isPushed("cancel")) {
            // ミニマップが開いていればまずそれを閉じる
            if (this.minimap) {
                this.toggleMinimap()
                return
            }
            App.sc.goto(async () => import("./SceneTitle").then(({ SceneTitle }) => new SceneTitle()))
        }
    }

    private move(direction: Direction) {
        const current = this.graph.node(this.selectedId)
        const neighbors = this.graph.neighbors(current, playerData)

        const next = MapNavigation.pickClosestInDirection(current, neighbors, direction)
        if (!next) return

        this.selectNode(next.id)
    }

    private selectNode(id: MapNodeId) {
        App.se.cursor.play()

        this.selectedId = id
        playerData.moveOnMap(id)
        this.nodeViews.select(id)
        this.minimap?.select(id)
        this.bee.flyTo(this.graph.node(id))
        this.camera.lookAt(this.graph.node(id), true)
        this.tintSeason(this.graph.node(id))
        this.crossfadeToSceneryBgm()
    }

    // 地図の左端を0、右端を1として、node の位置を --season に入れる。
    // 背景が画面に固定のとき(map.cssの.fixed-backdrop)、季節の色はこの位置の色だけが画面いっぱいに出る
    private tintSeason(node: MapNode) {
        const { minX, maxX } = this.graph.bounds()
        this.root.style.setProperty("--season", `${(node.x - minX) / (maxX - minX)}`)
    }

    // 選んでいるノードの景色の曲へクロスフェードする。曲が載っていない景色や読み込めなかった曲では、いまの曲のまま
    private async crossfadeToSceneryBgm() {
        const scenery = this.graph.node(this.selectedId).scenery
        if (scenery === this.bgmScenery) return
        this.bgmScenery = scenery

        const bgm = App.SetList.ofScenery(scenery)
        if (!bgm) return

        // 切り替えの途中でさらに別の景色へ移っても、最後に選んだ景色の曲名が出る。
        // 鳴っている曲との比較だと、A→B→Aと素早く移ったときにAの曲名が出ず、Bの曲名が残ってしまう
        const from = this.requestedBgmSrc ?? App.bm.getCurrentBgmSrc()
        this.requestedBgmSrc = bgm.src
        if (bgm.src !== from) this.showBgmTitle(bgm.title)

        try {
            await App.bm.crossfadeTo(bgm, AREA_BGM_CROSSFADE_SECONDS)
        } catch (error) {
            console.warn(`曲を読み込めません: ${bgm.src}`, error)
        }
    }

    // 曲名を右上へ出し、BGM_TITLE_MSかけて薄く現れて消える。出ている曲名があれば取り替える
    private showBgmTitle(title: string) {
        this.bgmTitleEl?.remove()

        const el = document.createElement("div")
        el.className = "map-bgm-title"
        el.textContent = title
        this.root.appendChild(el)
        this.bgmTitleEl = el

        el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], {
            duration: BGM_TITLE_MS,
            easing: "ease-out",
        }).addEventListener("finish", () => el.remove())
    }

    // 解放の演出。前に地図を開いていたときの後で開いた辺(MapSight.unseen)を一本ずつ見せ、そのたびにカメラを選んでいるノードへ戻す。
    // 演出の間は地図に触れられない(map.cssの.unlocking)
    private async showUnlocks() {
        const edges = this.sight.unseen()
        if (edges.length === 0) return

        this.unlocking = true
        this.root.classList.add("unlocking")

        const origin = this.graph.node(this.selectedId)
        await Awaits.sleep(UNLOCK_BEAT_MS)
        for (const edge of edges) {
            await this.showUnlock(edge)
            await this.camera.panTo(origin, UNLOCK_PAN_MS)
        }

        this.root.classList.remove("unlocking")
        this.unlocking = false
    }

    // 線を濃くしながら、カメラをedgeの先のノードへ運ぶ。
    // そのノードがこれで初めて行けるようになったなら、一拍おいて画面を光らせて揺らし、ノードの絵柄とまわりの小物を見せる
    private async showUnlock(edge: MapEdge) {
        const unlocksNode = !this.sight.isUnlocked(edge.to)
        this.sight.show(edge)
        this.nodeViews.fadeEdge(edge, UNLOCK_PAN_MS)
        await this.camera.panTo(edge.to, UNLOCK_PAN_MS)
        if (!unlocksNode) return

        await Awaits.sleep(UNLOCK_BEAT_MS)
        App.se.bulletSuzu.play()
        this.flash()
        shakeElement(this.root, UNLOCK_FLASH_MS, UNLOCK_SHAKE_PX)
        this.nodeViews.refresh()
        this.props.refresh()
        this.seals.refresh()
        await Awaits.sleep(UNLOCK_FLASH_MS)
    }

    // 画面を紙色に光らせ、UNLOCK_FLASH_MSかけて消す
    private flash() {
        const el = document.createElement("div")
        el.className = "map-unlock-flash"
        this.root.appendChild(el)

        el.animate([{ opacity: 0.8 }, { opacity: 0 }], {
            duration: UNLOCK_FLASH_MS,
            easing: "ease-out",
        }).addEventListener("finish", () => el.remove())
    }

    // 全ノードを一画面に収めた全体図の開閉。開いている間も方向キーでの選択移動はそのまま使える
    private toggleMinimap() {
        App.se.cursor.play()

        if (this.minimap) {
            Dom.fadeOutAndRemove(this.minimap.el, OVERLAY_FADE_OUT_MS)
            this.minimap = undefined
            return
        }

        this.minimap = new MapMinimap(
            this.graph,
            (id) => this.handleNodeTap(id),
            () => this.toggleMinimap(),
        )
        this.minimap.select(this.selectedId)
        // 左下の操作ボタンの上に被せ、全体図を開いている間は触れられないようにする
        this.root.appendChild(this.minimap.el)
    }

    // タップ操作用。既に選択中のノードをもう一度タップしたら決定(keyboardのok相当)、
    // そうでなければまずカーソルを合わせるだけ(keyboardの方向キー相当)にとどめる
    private handleNodeTap(id: MapNodeId) {
        if (this.equipMenu) return
        if (!this.graph.isUnlocked(this.graph.node(id), playerData)) return

        if (id === this.selectedId) {
            this.select()
            return
        }

        this.selectNode(id)
    }

    private select() {
        const node = this.graph.node(this.selectedId)
        if (!this.graph.isUnlocked(node, playerData)) return

        App.sc.goto(async () => import("./SceneGame").then(({ SceneGame }) => new SceneGame(node)))
    }

    private openEquipMenu() {
        this.equipMenu = new MapEquipMenu(
            this.root,
            () => {
                this.hud.updateScore()
                this.hud.updateLives()
                this.bee.wield(this.wieldedNeedle())
            },
            () => this.closeEquipMenu(),
        )
    }

    private closeEquipMenu() {
        this.equipMenu?.fadeOutAndRemove(OVERLAY_FADE_OUT_MS)
        this.equipMenu = undefined
    }

    // いま装備している針。消した針を装備したままの保存データでは、ゲームと同じく拡散として扱う(SceneGame)
    private wieldedNeedle(): MainEquipment {
        return mainEquipments[playerData.getLoadout().main] ?? mainEquipments.standard
    }
}
