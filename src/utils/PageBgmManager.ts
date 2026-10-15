import { BgmManager } from "@ipota/bgm-manager"

// ページが隠れている間は鳴らないBgmManager。
// 隠れている間に呼ばれたplay/pauseは覚えておき、ページが戻ったときに反映する。
// 戻ったときの再開をブラウザが拒んだ場合は、次のクリック・タッチ・キー入力で再開しなおす
export class PageBgmManager extends BgmManager {
    // 最後に呼ばれたのがplayならtrue、pause・loadならfalse
    private wantsPlay = false

    constructor() {
        super()
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) super.pause()
            else this.resumeIfWanted()
        })
        // ユーザー操作のイベント内でないとAudioContextを再開できないブラウザがあるので、操作のたびに再開を試みる
        for (const type of ["click", "touchend", "keydown"]) {
            document.addEventListener(type, () => this.resumeIfWanted())
        }
    }

    override load(params: BgmManager.LoadConfig) {
        this.wantsPlay = false
        return super.load(params)
    }

    override play() {
        this.wantsPlay = true
        if (document.hidden) return Promise.resolve()
        return super.play()
    }

    override pause() {
        this.wantsPlay = false
        return super.pause()
    }

    // 隠れている間は、戻ったときに鳴るかどうかを返す
    override isPlaying() {
        if (document.hidden) return this.wantsPlay
        return super.isPlaying()
    }

    private resumeIfWanted() {
        if (document.hidden || !this.wantsPlay || super.isPlaying()) return
        super.play()
    }
}
