/**
 * URLのクエリにarcade=trueがあればアーケードモードになる。
 * アーケードモードでは、このモジュールが評価された時点でセーブデータ(PlayerData)と設定(Settings)をlocalStorageから消し、
 * 残機の回復が爆速になる(PlayerData参照)。
 */
export namespace Arcade {
    export const enabled = new URLSearchParams(location.search).get("arcade") === "true"

    // キーがdanmaku-kari.で始まるものだけを消し、同じオリジンに置かれた他のゲームの保存データは残る
    if (enabled) {
        try {
            Object.keys(localStorage)
                .filter((key) => key.startsWith("danmaku-kari."))
                .forEach((key) => localStorage.removeItem(key))
        } catch {
            // localStorageが使えない環境では何も消さない
        }
    }
}
