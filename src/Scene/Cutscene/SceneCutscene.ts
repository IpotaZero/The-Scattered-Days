import { Ease, GenUtils } from "@ipota/functions"
import { App } from "../../App"
import { CutsceneId } from "../../Data/PlayerData"
import { IteratorQueue } from "../../Game/IteratorQueue"
import { Scene } from "../../utils/Scene/Scene"
import { Svg } from "./Svg"

/**
 * 文字を使わず、SVGの絵を動かして見せる一幕(OP・ED)。絵は派生クラスのコンストラクタでlayer()に描いておく。
 * 絵は(0,0)を中心とした1000×1000の正方形に描き、画面の縦横比に合わせて上下か左右がはみ出る。
 * 16:9の画面ではyが-281~281くらいまで、縦長のスマホではxが-230~230くらいまでしか映らない。
 * script()が終わるか、始まって1秒たってからok・cancel・クリックが押されると、nextが返す場面へ移る。
 */
export abstract class SceneCutscene extends Scene {
    private readonly svg = document.createElementNS(Svg.NS, "svg")

    // 絵の中のものの動き(ジェネレータ)を毎フレーム一歩ずつ進める
    protected readonly queue = new IteratorQueue()

    // 絵全体の上に重ねる幕。不透明にすると絵が見えなくなる
    private readonly veil = document.createElement("div")

    constructor(
        private readonly id: CutsceneId,
        private readonly next: () => Promise<Scene>,
    ) {
        super()

        this.root.classList.add("scene-cutscene", `scene-cutscene-${id}`)
        this.svg.setAttribute("class", "cutscene-picture")
        this.svg.setAttribute("viewBox", "-500 -500 1000 1000")
        this.svg.setAttribute("preserveAspectRatio", "xMidYMid slice")
        // 層にかけるぼかし。数字が大きいほど強くぼける
        this.svg.innerHTML = `
            <defs>
                <filter id="cutscene-blur-1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2" /></filter>
                <filter id="cutscene-blur-2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
                <filter id="cutscene-blur-3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
            </defs>
        `
        this.veil.className = "cutscene-veil"
    }

    protected async onStart(): Promise<void> {
        console.log(`SceneCutscene: ${this.id}`)

        const textureOverlay = document.createElement("div")
        textureOverlay.className = "texture-overlay"
        this.root.append(this.svg, this.veil, textureOverlay)

        this.queue.add(() => this.play())
        this.queue.add(() => this.skippable())
    }

    protected async onEnd(): Promise<void> {}

    update(): void {
        this.queue.update()
    }

    // 一幕の流れ。終わると次の場面へ移る
    protected abstract script(): Generator<void, void, void>

    // 層(<g>)を絵の一番手前に足す。あとから足した層ほど手前に描かれる。blurは1~3でぼかしの強さ、0ならぼかさない
    protected layer(className: string, blur: number): SVGGElement {
        const layer = Svg.g(className, "")
        if (blur > 0) layer.setAttribute("filter", `url(#cutscene-blur-${blur})`)
        this.svg.append(layer)
        return layer
    }

    // 幕をcolorの色にし、frameフレームかけて不透明度をfromからtoへ変える
    protected *fade(color: string, from: number, to: number, frame: number): Generator<void, void, void> {
        this.veil.style.background = color
        for (let i = 0; i <= frame; i++) {
            this.veil.style.opacity = `${from + (to - from) * Ease.InOut(i / frame)}`
            yield
        }
    }

    private *play(): Generator<void, void, void> {
        yield* this.script()
        this.finish()
    }

    private *skippable(): Generator<void, void, void> {
        yield* GenUtils.waitFrames(60)

        this.root.addEventListener("click", () => this.finish())
        while (!App.input.isPushed("ok") && !App.input.isPushed("cancel")) yield
        this.finish()
    }

    private finish() {
        App.sc.goto(this.next)
    }
}
