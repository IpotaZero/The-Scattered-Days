import { Transition } from "@ipota/functions"
import { Scene } from "./Scene"

export class SceneChanger {
    constructor(private readonly container: HTMLElement) {
        this.loadingIndicator.className = "now-loading"
        this.loadingIndicator.textContent = "Now Loading..."
    }

    private readonly loadingIndicator = document.createElement("div")

    private currentScene: Scene | undefined = undefined

    private isTransitioning = false

    onTransitionStart = () => {}
    onTransitionEnd = () => {}

    update() {
        if (this.currentScene && !this.isTransitioning) {
            this.currentScene.update()
        }
    }

    draw() {
        if (this.currentScene && !this.isTransitioning) {
            this.currentScene.draw()
        }
    }

    async goto(newScene: () => Promise<Scene>): Promise<void> {
        if (this.isTransitioning) return
        this.isTransitioning = true
        this.onTransitionStart()
        const loadingTimer = window.setTimeout(() => document.body.appendChild(this.loadingIndicator), 1000)
        await Transition.fadeOut(this.container, 200)

        if (this.currentScene) {
            await this.currentScene.end()
        }

        this.currentScene = await newScene()
        await this.currentScene.start()
        window.clearTimeout(loadingTimer)
        this.loadingIndicator.remove()
        this.onTransitionEnd()
        this.isTransitioning = false

        await Transition.fadeIn(this.container, 200)
    }
}
