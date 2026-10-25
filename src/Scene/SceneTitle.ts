import { Awaits } from "@ipota/functions"
import { App } from "../App"
import { playerData } from "../Data/PlayerData"
import { Menu } from "../utils/Menu/Menu"
import { Scene } from "../utils/Scene/Scene"
import { SvgFile } from "../utils/SvgFile"
import { SettingsMenu } from "./SettingsMenu"
import { TitleMeadow } from "./TitleMeadow"
import { Language } from "../Data/Language"

export class SceneTitle extends Scene {
    private menu?: Menu

    protected async onStart(): Promise<void> {
        console.log("SceneTitle")

        this.root.classList.add("scene-title", "paper-scene")
        // 飛び交う虫のSVGを読み込み終えてから草むらを作る
        await SvgFile.loadAll()
        this.root.appendChild(new TitleMeadow().element)
        this.root.insertAdjacentHTML(
            "beforeend",
            `
            <div class="title-content">
                <div class="title-top">
                    <div class="title-copyright">&copy; ososikirackets</div>
                    <div class="title-version">ver. 1.0.0</div>
                </div>
                <div class="title-logo">
                    <span class="title-logo-line">The</span>
                    <span class="title-logo-line">Scattered</span>
                    <span class="title-logo-line">Days!</span>
                </div>
            </div>
        `,
        )

        const menu: Menu = new Menu(
            `<div class="title-menu-stack"><div id="root"></div>${SettingsMenu.HTML}</div>`,
            {
                elementId: "root",
                options: () => [
                    [
                        {
                            type: "select",
                            label: Language.text("start"),
                            onSelect: () => {
                                App.se.start.play()

                                // 初めてのときだけ、マップの前にOPを流す
                                if (playerData.hasSeenCutscene("opening")) {
                                    App.sc.goto(async () =>
                                        import("./SceneMap").then(({ SceneMap }) => SceneMap.create()),
                                    )
                                } else {
                                    App.sc.goto(async () =>
                                        import("./Cutscene/SceneOpening").then(
                                            ({ SceneOpening }) =>
                                                new SceneOpening(() => {
                                                    playerData.markCutsceneSeen("opening")
                                                    return import("./SceneMap").then(({ SceneMap }) =>
                                                        SceneMap.create(),
                                                    )
                                                }),
                                        ),
                                    )
                                }
                            },
                        },
                    ],
                    [
                        {
                            type: "submenu",
                            label: Language.text("titleSettings"),
                            // #rootはtitle.css側で横へ退場させるので、ここでは隠さない
                            hides: [],
                            subMenu: () => new SettingsMenu(menu).box(),
                        },
                    ],
                ],
            },
            App.input,
            App.se.menu,
        )

        menu.container.classList.add("title-menu")
        this.root.appendChild(menu.container)
        this.menu = menu

        const textureOverlay = document.createElement("div")
        textureOverlay.className = "texture-overlay"
        this.root.appendChild(textureOverlay)

        if (document.fullscreenEnabled && !App.pwa.installed) {
            const fullscreenToggle = document.createElement("button")
            fullscreenToggle.className = "title-fullscreen-toggle"
            fullscreenToggle.textContent = "⛶"
            fullscreenToggle.addEventListener("click", () => {
                if (document.fullscreenElement) {
                    document.exitFullscreen()
                } else {
                    document.documentElement.requestFullscreen()
                }
            })
            this.root.appendChild(fullscreenToggle)
        }

        this.startBGM()
    }

    private async startBGM() {
        // OPやEDなど、タイトルを出るときにフェードアウトして止めた曲が残っているので、続きから1秒かけて戻す
        if (App.bm.getCurrentBgmSrc() === App.SetList.title.src) {
            if (!App.bm.isPlaying()) await App.bm.fadeIn(1)
            return
        }

        // マップなどで別の曲が鳴っていれば、1秒かけて消してからタイトルの曲を始める
        if (App.bm.getCurrentBgmSrc() !== undefined && App.bm.isPlaying()) await App.bm.fadeOut(1)

        await Promise.all([App.bm.load(App.SetList.title), Awaits.sleep(1000)])
        await App.bm.play()
    }

    protected async onEnd(): Promise<void> {
        await App.bm.fadeOut(1)
    }

    update(): void {
        this.menu?.update()
    }
}
