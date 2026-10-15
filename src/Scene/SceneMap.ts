import { App } from "../App"
import { Dom } from "../Dom"
import { playerData } from "../Data/PlayerData"
import { MapGraph, MapNodeId } from "../Map/MapGraph"
import { MapEquipMenu } from "../Map/MapEquipMenu"
import { MapHud } from "../Map/MapHud"
import { MapNavigation, type Direction } from "../Map/MapNavigation"
import { MapNodeViews } from "../Map/MapNodeViews"
import { MapMinimap } from "../Map/MapMinimap"
import { MapBee } from "../Map/MapBee"
import { MapBadgeSeals } from "../Map/MapBadgeSeals"
import { MapCamera } from "../Map/MapCamera"
import { MapProps } from "../Map/MapProps"
import { InputCode } from "../utils/InputCode"
import { isSmartPhone } from "../utils/Functions/isSmartPhone"
import { Scene } from "../utils/Scene/Scene"
import { SvgFile } from "../utils/SvgFile"
import type { Scenery } from "../World/Scenery"

// 全体図・型と残機の画面を閉じるときのフェードアウトにかける時間
const OVERLAY_FADE_OUT_MS = 200

// 別の景色の塊へ入ったときの、曲のクロスフェードにかける秒数
const AREA_BGM_CROSSFADE_SECONDS = 1

// 曲が切り替わったときに、右上へ曲名を出しておく時間(ms)
const BGM_TITLE_MS = 5000

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

    private constructor(private readonly graph: MapGraph) {
        super()
        // 前回いたノードから始める。マップの変更で消えた/未解放になったノードならスタート地点に戻す
        const saved = graph.nodes.find((node) => node.id === playerData.mapNodeId)
        this.selectedId = saved && graph.isUnlocked(saved, playerData) ? saved.id : graph.start.id
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
                    <svg class="map-edges">
                        ${MapNodeViews.renderEdges(this.graph)}
                    </svg>
                    <div class="map-nodes"></div>
                </div>
                <div class="texture-overlay map-backdrop"></div>
            </div>
            <div class="map-lives">
                <div class="map-lives-count"></div>
                <div class="map-lives-recovery"></div>
                <div class="map-score"></div>
            </div>
            <div class="map-controls">
                ${isSmartPhone ? "" : `<div data-control="toggle-minimap"><span class="nowrap">全体図</span>${isSmartPhone ? `` : `(${InputCode.primaryLabel(App.settings.keyConfig.slow)})`}</div>`}
                <div data-control="open-equip"><span class="nowrap">型の変更</span>${isSmartPhone ? `` : `(${InputCode.primaryLabel(App.settings.keyConfig.action)})`}</div>
                <div data-control="back-to-title"><span class="nowrap">タイトルへ戻る</span>${isSmartPhone ? `` : `(${InputCode.primaryLabel(App.settings.keyConfig.cancel)})`}</div>
            </div>
        `

        // スマホは全体図のボタンを置かない代わりに、ピンチで縮めて広く見渡せるようにする
        this.camera = new MapCamera(
            this.root,
            this.root.querySelector<HTMLElement>(".map-camera")!,
            this.graph.bounds(),
            isSmartPhone ? { min: 0.3, max: 2 } : { min: 1, max: 1 },
            () => !this.equipMenu && !this.minimap,
        )

        const nodesEl = this.root.querySelector<HTMLElement>(".map-nodes")!
        // 塊のまわりの小物は、辺より手前・ノードより奥に置く
        nodesEl.before(new MapProps(this.graph, playerData).el)
        // 最後の場所への関所の辺には、免状の印を辺より手前・ノードより奥に並べる
        nodesEl.before(new MapBadgeSeals(this.graph, playerData).el)
        this.nodeViews = new MapNodeViews(this.graph, nodesEl, (id) => {
            // スワイプ・ピンチの指を離した直後に発火するclickをタップ選択として扱わない
            if (this.camera.dragged) return
            this.handleNodeTap(id)
        })
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

        this.bee = new MapBee(this.graph.node(this.selectedId))
        this.root.querySelector(".map-world")!.appendChild(this.bee.el)

        this.hud = new MapHud(this.root.querySelector<HTMLElement>(".map-lives")!)

        // 初期カメラは選択中ノードを中央に据えた状態から始める(アニメーションなし)
        this.camera.lookAt(this.graph.node(this.selectedId), false)

        this.crossfadeToSceneryBgm()
    }

    protected async onEnd(): Promise<void> {}

    update(): void {
        playerData.recoverLivesOverTime()
        this.hud.updateLives()

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
        this.crossfadeToSceneryBgm()
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
            },
            () => this.closeEquipMenu(),
        )
    }

    private closeEquipMenu() {
        this.equipMenu?.fadeOutAndRemove(OVERLAY_FADE_OUT_MS)
        this.equipMenu = undefined
    }
}
