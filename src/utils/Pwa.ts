// Service Workerを登録する。
// インストールしたアプリとして起動されたとき(installed)は、全画面でなければクリック・タッチ・キー入力のたびに全画面にする
export class Pwa {
    // 起動したときの表示モードで決める。後からブラウザで全画面にしても変わらない
    readonly installed =
        matchMedia("(display-mode: fullscreen), (display-mode: standalone), (display-mode: minimal-ui)").matches ||
        document.referrer.startsWith("android-app://")

    constructor() {
        navigator.serviceWorker?.register("./sw.js")

        if (!this.installed || !document.fullscreenEnabled) return

        for (const type of ["pointerup", "keydown"]) {
            document.addEventListener(type, () => {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
            })
        }
    }
}
