import { playerData } from "../Data/PlayerData"
import { Game } from "../Game/Game"
import { mainEquipments, subEquipments } from "../Game/Equipment/PlayerEquipment"
import type { PlayerConfig } from "../Game/Actor/Player"
import { MapGraph, type MapNode } from "../Map/MapGraph"
import { Menu } from "../utils/Menu/Menu"
import { Scene } from "../utils/Scene/Scene"
import { App } from "../App"
import { GameBackdrop } from "./GameBackdrop"

export class SceneGame extends Scene {
    private game?: Game
    private resultMenu?: Menu

    constructor(private readonly node: MapNode) {
        super()
    }

    protected async onStart(): Promise<void> {
        console.log(`SceneGame: ${this.node.id}`)

        this.game = await Game.create({
            createStage: (game) => this.node.stage(game),
            input: App.input,
            analogInput: App.analogInput,
            dragScale: App.settings.dragScaleLevel / 10,
            liteBullets: App.settings.liteBullets,
            se: App.se,
            onWin: () => {
                // 追加残機で受けた被弾も数えるので、一度も被弾せずにクリアしたときだけノーミスになる
                this.node.recordClear(playerData, playerData.getLoadout().main, this.game!.player.hitCount === 0)
                this.showResultMenu("--:: 前進 ::--", "Next", () => this.sceneAfterWin())
            },
            onLose: (score) => {
                playerData.addScore(score)
                this.showResultMenu("--:: 停滞 ::--", "Back", () =>
                    import("./SceneMap").then(({ SceneMap }) => SceneMap.create()),
                )
            },
            onScoreCollected: (score) => playerData.addScore(score),
            onPlayerHit: (life) => playerData.setLives(life),
            playerConfig: createPlayerConfig(),
            setFPS: (fps) => App.looper.setFPS(fps),
            scenery: this.node.scenery,
        })

        // キャンバスの地の色・キャンバスの外の景色は、場所ごとにCSS(css/scenery.css)で変える
        this.root.classList.add("scene-game", `scenery-${this.node.scenery.id}`)
        this.game.canvas.id = "main"
        this.root.append(new GameBackdrop().element, this.game.canvas, this.game.figureLayer.box, this.game.textBox.box)
    }

    protected async onEnd(): Promise<void> {
        this.game?.dispose()
    }

    update(): void {
        // クリア/ゲームオーバー後もGame自体の更新(敵・弾・カメラなど)は続ける
        this.game?.update()
        this.resultMenu?.update()
    }

    draw(): void {
        this.game?.draw()
    }

    // クリア/ゲームオーバー時に、やり直すか次の場面(next)へ進むかを選ぶメニューを重ねて表示する。
    // 進むボタンは、勝てば「Next」、負ければ引き返す「Back」と呼び分ける
    private showResultMenu(title: string, nextLabel: string, next: () => Promise<Scene>) {
        if (this.resultMenu) return

        this.resultMenu = new Menu(
            `<div id="root"></div>`,
            {
                elementId: "root",
                title,
                options: () => [
                    [
                        {
                            type: "select",
                            label: "Retry",
                            onSelect: () => {
                                App.sc.goto(async () => new SceneGame(this.node))
                            },
                        },
                        {
                            type: "select",
                            label: nextLabel,
                            onSelect: () => {
                                App.sc.goto(next)
                            },
                        },
                    ],
                ],
                initialCursor: () => ({ row: 0, col: 1 }),
            },
            App.input,
            App.se.menu,
        )

        this.resultMenu.container.classList.add("pause-menu")
        this.root.appendChild(this.resultMenu.container)
    }

    // 終点を初めてクリアしたときはED・クレジットを流してタイトルへ、それ以外はマップへ進む
    private async sceneAfterWin(): Promise<Scene> {
        const graph = await MapGraph.load()
        if (this.node.id === graph.goal.id && !playerData.hasSeenCutscene("ending")) {
            return import("./Cutscene/SceneEnding").then(
                ({ SceneEnding }) =>
                    new SceneEnding(() => {
                        playerData.markCutsceneSeen("ending")
                        return import("./Cutscene/SceneCredits").then(
                            ({ SceneCredits }) =>
                                new SceneCredits(() => import("./SceneTitle").then(({ SceneTitle }) => new SceneTitle())),
                        )
                    }),
            )
        }
        return import("./SceneMap").then(({ SceneMap }) => SceneMap.create())
    }
}

// playerData(セーブデータ)の内容をPlayerConfigへ詰め替える。
// Player自身はplayerDataを直接参照しないので、この変換をScene層で行う
function createPlayerConfig(): PlayerConfig {
    const loadout = playerData.getLoadout()

    return {
        initialLife: playerData.getLives(),
        maxLife: playerData.getMaxLives(),
        mainEquipment: mainEquipments[loadout.main] ?? mainEquipments.standard,
        subEquipment: loadout.sub ? subEquipments[loadout.sub] : undefined,
    }
}
