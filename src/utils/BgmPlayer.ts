import { Awaits } from "@ipota/functions"

// フェードの端の音量。0ちょうどにはせず、ほぼ無音にする
const NEARLY_SILENT = 0.001

export namespace BgmPlayer {
    export type Track = {
        src: string
        // 曲ごとの音量の倍率
        trackVolume?: number
    }
}

// <audio>1つぶん。<audio>が曲を少しずつ読み込みながら鳴らし、鳴らし終えた分は手放す。
// 音は <audio> → trackGain(曲ごとの音量) → fade(フェード) → destination の順に流れる
class Deck {
    readonly el = new Audio()
    readonly fade: GainNode
    private readonly trackGain: GainNode

    // いま入っている曲。空ならundefined
    src?: string
    // 曲を入れ替える・止めるたびに増える。古い再生の結果を見分けるのに使う
    loads = 0
    // プログラムから鳴らせる状態か。iOSは、ユーザー操作の中で鳴らしたことのある<audio>でないと鳴らせない
    private unlocked = false

    constructor(ctx: AudioContext, destination: AudioNode) {
        this.el.loop = true

        this.trackGain = ctx.createGain()
        this.fade = ctx.createGain()
        ctx.createMediaElementSource(this.el).connect(this.trackGain)
        this.trackGain.connect(this.fade)
        this.fade.connect(destination)
    }

    // 曲を入れ替えて、読み込みを始める。鳴らすのはplay()
    load(track: BgmPlayer.Track) {
        this.loads++
        this.src = track.src
        this.trackGain.gain.value = track.trackVolume ?? 1
        this.fade.gain.cancelScheduledValues(0)
        this.fade.gain.value = 1

        this.el.preload = "auto"
        this.el.src = track.src
    }

    // 曲を取り除き、読み込んだ分を手放す
    stop() {
        this.loads++
        this.src = undefined
        this.release()
    }

    // 鳴らし始めるまで待つ。曲が入っていなければ何もしない
    async play() {
        if (this.src === undefined) return

        const loads = this.loads
        try {
            await this.el.play()
            this.unlocked = true
        } catch (error) {
            // 鳴らし始める前に、別の曲へ入れ替えられたり、止められたりした
            if (loads !== this.loads || (error instanceof DOMException && error.name === "AbortError")) return
            throw error
        }
    }

    // ユーザー操作の中で呼ぶ。無音を一度鳴らして、プログラムから鳴らせるようにする。
    // 曲が入っていればそのplay()で済むので、何もしない。操作の中でなくて鳴らせなければ、次の機会にやり直す
    async unlock() {
        if (this.unlocked || this.src !== undefined) return

        const loads = ++this.loads
        this.el.src = Deck.silence
        try {
            await this.el.play()
            this.unlocked = true
        } catch {
            // 次の操作でやり直す
        } finally {
            // 待っている間に曲が入っていれば、それを手放さない
            if (loads === this.loads) this.release()
        }
    }

    private release() {
        this.el.pause()
        this.el.removeAttribute("src")
        this.el.load()
    }

    // 短い無音のWAV。unlock()が鳴らす
    private static readonly silence = Deck.silentWav()

    private static silentWav(): string {
        const samples = 800
        // 8bitのPCMは中央の値が無音。ヘッダーを書き込む以外は、全部その値で埋める
        const bytes = new Uint8Array(44 + samples).fill(0x80)
        const view = new DataView(bytes.buffer)
        const text = (offset: number, value: string) =>
            [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))

        text(0, "RIFF")
        view.setUint32(4, 36 + samples, true)
        text(8, "WAVE")
        text(12, "fmt ")
        view.setUint32(16, 16, true)
        view.setUint16(20, 1, true)
        view.setUint16(22, 1, true)
        view.setUint32(24, 8000, true)
        view.setUint32(28, 8000, true)
        view.setUint16(32, 1, true)
        view.setUint16(34, 8, true)
        text(36, "data")
        view.setUint32(40, samples, true)

        return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`
    }
}

// BGMを鳴らす。曲は<audio>が少しずつ読み込みながら鳴らす(ストリーミング)ので、
// メモリに載るのは鳴らしているところの前後だけで、曲の長さによらない。
// 曲のクロスフェード用に<audio>を2つ持ち、使い回す。
// ページが隠れている間は鳴らない。隠れている間に呼ばれたplay/pauseは覚えておき、ページが戻ったときに反映する。
// 戻ったときの再開をブラウザが拒んだ場合は、次のクリック・タッチ・キー入力で再開しなおす
export class BgmPlayer {
    private readonly ctx = new AudioContext()
    private readonly master = this.ctx.createGain()
    private readonly decks: readonly Deck[]

    // 曲が入っている(いま鳴っている、または止めてある)方
    private current: Deck
    // もう一方。クロスフェードで新しい曲を読み込む。フェードアウト中の曲が入っていることもある
    private other: Deck

    // 最後に呼ばれたのがplayならtrue、pause・loadならfalse
    private wantsPlay = false
    // crossfadeTo / load のたびに進める。読み込み中に呼ばれた古いクロスフェードを見分ける
    private crossfadeToken = 0

    constructor() {
        this.master.connect(this.ctx.destination)
        this.current = new Deck(this.ctx, this.master)
        this.other = new Deck(this.ctx, this.master)
        this.decks = [this.current, this.other]

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) this.pauseDecks()
            else this.resumeIfWanted()
        })
        // ユーザー操作のイベント内でないと鳴らせないブラウザがあるので、操作のたびに再開を試みる
        for (const type of ["click", "touchend", "keydown"]) {
            document.addEventListener(type, () => this.resumeIfWanted())
        }
    }

    // 曲を入れ替える。鳴らし始めるのはplay()を呼んでから
    async load(track: BgmPlayer.Track) {
        this.crossfadeToken++
        this.wantsPlay = false
        this.pauseDecks()
        this.other.stop()
        this.current.load(track)
    }

    // 鳴っている曲をseconds秒かけてフェードアウトさせながら、新しい曲を同じ秒数でフェードインする。
    // 止まっているときは、曲を入れ替えてフェードインだけを行う。
    // 読み込み中にもう一度呼ぶと、先の呼び出しは捨てられる(最後の呼び出しだけが鳴る)。
    // 同じ曲が鳴っているときは、何も鳴らし直さない(読み込み中の別の曲があれば、それは取り消す)
    async crossfadeTo(track: BgmPlayer.Track, seconds: number) {
        if (!this.isPlaying()) {
            await this.load(track)
            await this.fadeIn(seconds)
            return
        }

        // 同じ曲が鳴っていても、読み込み中の別の曲があれば取り消す(A→B→Aと素早く求められたとき、Bが後から鳴らないようにする)
        const token = ++this.crossfadeToken
        if (this.current.src === track.src) return

        const incoming = this.other
        incoming.load(track)
        incoming.fade.gain.value = NEARLY_SILENT
        const loads = incoming.loads
        try {
            await incoming.play()
        } catch (error) {
            incoming.stop()
            throw error
        }

        // 読み込み中に別の曲が求められた。この曲は鳴らさずに捨てる(求めた先が同じ入れ物を使っていたら、触らない)
        if (token !== this.crossfadeToken) {
            if (incoming.loads === loads) incoming.stop()
            return
        }

        const outgoing = this.current
        this.current = incoming
        this.other = outgoing
        this.ramp(outgoing.fade, NEARLY_SILENT, seconds)
        this.ramp(incoming.fade, 1, seconds)

        const outgoingLoads = outgoing.loads
        await Awaits.sleep(seconds * 1000)

        // 待っている間に別の曲の入れ物として使われていなければ、鳴らし終えた曲を手放す
        if (this.other === outgoing && outgoing.loads === outgoingLoads) outgoing.stop()
    }

    getCurrentBgmSrc(): string | undefined {
        return this.current.src
    }

    async play() {
        this.wantsPlay = true
        if (document.hidden) return

        await this.start()
    }

    async pause() {
        this.wantsPlay = false
        this.pauseDecks()
    }

    // 隠れている間は、戻ったときに鳴るかどうかを返す
    isPlaying(): boolean {
        if (document.hidden) return this.wantsPlay

        return (
            this.wantsPlay &&
            this.ctx.state === "running" &&
            (this.current.src === undefined || !this.current.el.paused)
        )
    }

    // 再生を始め、seconds秒かけてフェードインする
    async fadeIn(seconds: number) {
        const gain = this.current.fade.gain
        const now = this.ctx.currentTime
        gain.cancelScheduledValues(now)
        gain.setValueAtTime(NEARLY_SILENT, now)

        await this.play()
        await this.fadeTo(1, seconds)
    }

    // seconds秒かけてフェードアウトし、止める
    async fadeOut(seconds: number) {
        await this.fadeTo(NEARLY_SILENT, seconds)
        await this.pause()
    }

    // 全曲の音量(0~1)
    setVolume(volume: number) {
        this.master.gain.value = volume
    }

    // 最初の呼び出しは、操作のイベントの中で<audio>を鳴らせるようにする(iOS)。
    // 呼び出しの先頭からawaitより前に、2つとも同期で呼び出しておく必要がある
    private async start() {
        try {
            await Promise.all([
                this.ctx.resume(),
                ...this.decks.map((deck) => deck.unlock()),
                ...this.decks.map((deck) => deck.play()),
            ])
        } catch (error) {
            console.warn("BGMを鳴らせません", error)
        }
    }

    private pauseDecks() {
        for (const deck of this.decks) deck.el.pause()
    }

    private resumeIfWanted() {
        if (document.hidden || !this.wantsPlay || this.isPlaying()) return

        this.start()
    }

    // 止まっているとフェードの時間が進まないので、待たずに目標の音量にする
    private fadeTo(target: number, seconds: number): Promise<void> {
        const gain = this.current.fade.gain
        if (!this.isPlaying()) {
            gain.cancelScheduledValues(0)
            gain.value = target
            return Promise.resolve()
        }

        this.ramp(this.current.fade, target, seconds)
        return Awaits.sleep(seconds * 1000)
    }

    private ramp(node: GainNode, target: number, seconds: number) {
        const now = this.ctx.currentTime
        // 進行中のランプがあっても、実際の現在値が取れる
        const current = node.gain.value
        node.gain.cancelScheduledValues(now)
        node.gain.setValueAtTime(current, now)
        node.gain.linearRampToValueAtTime(target, now + seconds)
    }
}
