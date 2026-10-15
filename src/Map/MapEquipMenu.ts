import { Dom } from "../Dom"
import { EquipmentId } from "../Data/Equipment"
import { App } from "../App"
import { LIFE_PRICE, playerData } from "../Data/PlayerData"
import { mainEquipments, subEquipments, type SubEquipment } from "../Game/Equipment/PlayerEquipment"
import { InputCode } from "../utils/InputCode"
import { isSmartPhone } from "../utils/Functions/isSmartPhone"
import { Menu, MenuOption, MenuOptionBox } from "../utils/Menu/Menu"
import { MenuPreset } from "../utils/Menu/MenuPreset"

// 所持している主装備・副装備の中から選び直せる、右側に開くモーダル
export class MapEquipMenu {
    private readonly menu: Menu
    private readonly descriptionEl: HTMLElement

    // pollenChangedは花粉の量が変わったとき(技の習得・残機の回復)、closeは閉じたいときに呼ばれる
    constructor(
        parent: HTMLElement,
        private readonly pollenChanged: () => void,
        private readonly close: () => void,
    ) {
        this.menu = new Menu(
            `<div id="equip-root"></div>
             <div id="equip-main-options" class="fadeout"></div>
             <div id="equip-sub-options" class="fadeout"></div>
             <div id="equip-learn" class="fadeout"></div>
             <div id="equip-life" class="fadeout"></div>
             <div class="equip-description"></div>
             <div class="texture-overlay"></div>`,
            {
                elementId: "equip-root",
                title: "--:: 型 ::--",
                options: () => this.buildRootOptions(),
            },
            App.input,
            App.se.menu,
        )

        this.menu.onBack = close
        this.menu.container.classList.add("map-equip-modal")
        parent.appendChild(this.menu.container)

        this.descriptionEl = this.menu.container.querySelector<HTMLElement>(".equip-description")!
    }

    update(): void {
        this.menu.update()

        if (App.input.isPushed("action")) this.close()
    }

    fadeOutAndRemove(ms: number): void {
        Dom.fadeOutAndRemove(this.menu.container, ms)
    }

    // ルート: 「針: ○○」「技: ○○」「戻る」の行。針と技は選ぶとサブメニューが開く
    private buildRootOptions(): MenuOption[][] {
        return [
            [
                {
                    type: "submenu",
                    label: `針: ${mainEquipments[playerData.getLoadout().main]?.label ?? playerData.getLoadout().main}`,
                    hides: [],
                    onFocus: () => this.hideDescription(),
                    subMenu: () => this.buildMainSubMenu(),
                },
            ],
            [
                {
                    type: "submenu",
                    label: `技: ${this.getSubLabel()}`,
                    // 技の一覧を開いている間はルートを隠す(並べると画面からはみ出す)
                    hides: ["equip-root"],
                    onFocus: () => this.hideDescription(),
                    subMenu: () => this.buildSubSubMenu(),
                },
            ],
            // [this.buildLifeOption()],
            [this.buildBackOption()],
        ]
    }

    private buildBackOption(): MenuOption {
        return {
            type: "select",
            label: `戻る`,
            onFocus: () => this.hideDescription(),
            onSelect: () => {
                this.menu.back(1)
            },
            sound: "cancel",
        }
    }

    // 残機が満タンか花粉が足りなければ選べない。選ぶと回復するかを尋ね、「はい」で花粉を払って残機を1つ回復し、ルートへ戻る
    private buildLifeOption(): MenuOption {
        const price = `<span class="equip-price">花粉 ${LIFE_PRICE.toLocaleString()}</span>`

        return {
            type: "submenu",
            label: `残機: ${playerData.getLives()} / ${playerData.getMaxLives()}　${price}`,
            hides: ["equip-root"],
            disabled: () => !playerData.canBuyLife(),
            onFocus: () => this.showDescription("花粉を払って残機を1つ回復する。"),
            subMenu: () =>
                MenuPreset.buildConfirmBox(
                    this.menu,
                    () => {
                        // 確認を開いている間に実時間で満タンまで回復していたら、何も払わずに戻る
                        if (playerData.canBuyLife()) playerData.buyLife()
                        this.pollenChanged()
                        this.menu.back(1)
                    },
                    {
                        title: "--:: 回復する? ::--",
                        elementId: "equip-life",
                        confirmLabel: `はい　${price}`,
                    },
                ),
        }
    }

    private buildMainSubMenu(): MenuOptionBox {
        return {
            elementId: "equip-main-options",
            title: "--:: 針を選択 ::--",
            options: () => this.buildMainOptions(),
            // 開いた瞬間、現在装備している主装備にカーソルを合わせる
            initialCursor: () => {
                const row = Object.keys(mainEquipments).indexOf(playerData.getLoadout().main)
                return { row: Math.max(row, 0), col: 0 }
            },
        }
    }

    // 所持していない主装備もdisabledとして一覧に出す(存在を知らせつつ選べないようにする)
    private buildMainOptions(): MenuOption[][] {
        return [
            ...Object.keys(mainEquipments).map((id) => [
                {
                    type: "select" as const,
                    label: mainEquipments[id]?.label ?? id,
                    disabled: () => !playerData.getOwnedMainEquipmentIds().has(id),
                    onFocus: () => this.showDescription(mainEquipments[id]?.description ?? ""),
                    onSelect: () => {
                        playerData.setLoadout({ ...playerData.getLoadout(), main: id })
                        this.menu.backToRoot()
                    },
                },
            ]),
            [this.buildBackOption()],
        ]
    }

    private buildSubSubMenu(): MenuOptionBox {
        return {
            elementId: "equip-sub-options",
            title: "--:: 技を選択 ::--",
            options: () => this.buildSubOptions(),
            // 開いた瞬間、現在装備している副装備にカーソルを合わせる(「なし」は先頭行)
            initialCursor: () => {
                const subId = playerData.getLoadout().sub
                const row = subId === null ? 0 : 1 + Object.keys(subEquipments).indexOf(subId)
                return { row: Math.max(row, 0), col: 0 }
            },
        }
    }

    private buildSubOptions(): MenuOption[][] {
        return [
            [
                {
                    type: "select",
                    label: "なし",
                    onFocus: () => this.showDescription("技を使用しない。"),
                    onSelect: () => {
                        playerData.setLoadout({ ...playerData.getLoadout(), sub: null })
                        this.menu.backToRoot()
                    },
                },
            ],
            ...Object.keys(subEquipments).map((id) => [this.buildSubOption(id)]),
            [this.buildBackOption()],
        ]
    }

    // 持っている技は選べばそのまま装備する。まだ持っていない技は、花粉を払って習得するかを尋ねる
    private buildSubOption(id: EquipmentId): MenuOption {
        const equipment = subEquipments[id]!
        const equip = () => {
            playerData.setLoadout({ ...playerData.getLoadout(), sub: id })
            this.menu.back(2)
        }

        if (playerData.getOwnedSubEquipmentIds().has(id)) {
            return {
                type: "select",
                label: equipment.label,
                onFocus: () => this.showDescription(this.describeSub(equipment)),
                onSelect: equip,
            }
        }

        return {
            type: "submenu",
            label: `${equipment.label}　<span class="equip-price">花粉 ${equipment.price.toLocaleString()}</span>`,
            hides: ["equip-sub-options"],
            disabled: () => playerData.getTotalScore() < equipment.price,
            onFocus: () => this.showDescription(this.describeSub(equipment)),
            subMenu: () => ({
                ...MenuPreset.buildConfirmBox(
                    this.menu,
                    () => {
                        playerData.learnSubEquipment(id, equipment.price)
                        this.pollenChanged()
                        equip()
                    },
                    {
                        title: "--:: 習得する? ::--",
                        elementId: "equip-learn",
                        // 題に値段まで入れるとスマホの幅からはみ出すので、払う量は「はい」の側に添える
                        confirmLabel: `はい　<span class="equip-price">花粉 ${equipment.price.toLocaleString()}</span>`,
                    },
                ),
            }),
        }
    }

    // 装備選択肢にカーソルが乗っている間、その装備の説明を表示する
    private showDescription(description: string) {
        this.descriptionEl.textContent = description
        this.descriptionEl.classList.toggle("visible", description.length > 0)
    }

    private hideDescription() {
        this.showDescription("")
    }

    // ステージ中に技を使う操作の説明。スマホは2本指タップ、それ以外は技に割り当てたキー
    private actionHint(): string {
        return isSmartPhone
            ? "ステージ中、2本の指で画面をタップすると技を使う。"
            : `ステージ中、${InputCode.primaryLabel(App.settings.keyConfig.action)}キーを押すと技を使う。`
    }

    // 説明文。action入力で使う技には、使い方を続ける
    private describeSub(equipment: SubEquipment): string {
        return equipment.manual ? `${equipment.description}${this.actionHint()}` : equipment.description
    }

    private getSubLabel(): string {
        const subId = playerData.getLoadout().sub
        if (!subId) return "なし"

        // 削除した技を装備したままの保存データもある。ゲームでは技なしとして扱われる(SceneGame)ので、表示もそれに合わせる
        return subEquipments[subId]?.label ?? "なし"
    }
}
