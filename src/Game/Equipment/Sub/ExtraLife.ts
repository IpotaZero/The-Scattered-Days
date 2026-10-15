import type { SubEquipment } from "../types"

// 追加残機は、ステージの始めに自機へ追加残機を1つ持たせる技。
// 被弾すると残機より先に追加残機が減り、残機は減らない。追加残機はステージをまたいで引き継がれない。
// action入力では何も起きない
export const extraLife: SubEquipment = {
    label: "追加残機",
    description: "追加の残機が得られる。",
    price: 5000,
    manual: false,
    *action(player) {
        player.extraLives = 1
    },
}
