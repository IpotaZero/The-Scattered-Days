import { Dom } from "../Dom"
import { EquipmentId } from "../Data/Equipment"
import { App } from "../App"
import { LIFE_PRICE, playerData } from "../Data/PlayerData"
import { mainEquipments, subEquipments, type SubEquipment } from "../Game/Equipment/PlayerEquipment"
import { InputCode } from "../utils/InputCode"
import { isSmartPhone } from "../utils/Functions/isSmartPhone"
import { Menu, MenuOption, MenuOptionBox } from "../utils/Menu/Menu"
import { MenuPreset } from "../utils/Menu/MenuPreset"
import { Language } from "../Data/Language"

// 所持している主装備・副装備の中から選び直せる、右側に開くモーダル
export class MapEquipMenu {
    private readonly menu: Menu
    private readonly descriptionEl: HTMLElement

    // changedは型か花粉の量が変わったとき(針の選び直し・技の習得・残機の回復)、closeは閉じたいときに呼ばれる
    constructor(
        parent: HTMLElement,
        private readonly changed: () => void,
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
                title: () => Language.text("changeType"),
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
                    label: `${Language.text("needle")}: ${Language.equipment(playerData.getLoadout().main, "label", mainEquipments[playerData.getLoadout().main]?.label ?? playerData.getLoadout().main)}`,
                    hides: ["equip-root"],
                    onFocus: () => this.hideDescription(),
                    subMenu: () => this.buildMainSubMenu(),
                },
            ],
            [
                {
                    type: "submenu",
                    label: `${Language.text("technique")}: ${this.getSubLabel()}`,
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
            label: Language.text("back"),
            onFocus: () => this.hideDescription(),
            onSelect: () => {
                this.menu.back(1)
            },
            sound: "cancel",
        }
    }

    // 残機が満タンか花粉が足りなければ選べない。選ぶと回復するかを尋ね、「はい」で花粉を払って残機を1つ回復し、ルートへ戻る
    private buildLifeOption(): MenuOption {
        const price = `<span class="equip-price">${Language.text("pollen")} ${LIFE_PRICE.toLocaleString()}</span>`

        return {
            type: "submenu",
            label: `${Language.text("lives")}: ${playerData.getLives()} / ${playerData.getMaxLives()}　${price}`,
            hides: ["equip-root"],
            disabled: () => !playerData.canBuyLife(),
            onFocus: () => this.showDescription(Language.text("restoreLifeDescription")),
            subMenu: () =>
                MenuPreset.buildConfirmBox(
                    this.menu,
                    () => {
                        // 確認を開いている間に実時間で満タンまで回復していたら、何も払わずに戻る
                        if (playerData.canBuyLife()) playerData.buyLife()
                        this.changed()
                        this.menu.back(1)
                    },
                    {
                        title: () => Language.text("restoreLife"),
                        elementId: "equip-life",
                        confirmLabel: `${Language.text("yes")}　${price}`,
                        cancelLabel: Language.text("no"),
                    },
                ),
        }
    }

    private buildMainSubMenu(): MenuOptionBox {
        return {
            elementId: "equip-main-options",
            title: () => Language.text("chooseNeedle"),
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
                    label: Language.equipment(id, "label", mainEquipments[id]?.label ?? id),
                    disabled: () => !playerData.getOwnedMainEquipmentIds().has(id),
                    onFocus: () => this.showDescription(Language.equipment(id, "description", mainEquipments[id]?.description ?? "")),
                    onSelect: () => {
                        playerData.setLoadout({ ...playerData.getLoadout(), main: id })
                        this.changed()
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
            title: () => Language.text("chooseTechnique"),
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
                    label: Language.text("none"),
                    onFocus: () => this.showDescription(Language.text("noAbility")),
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
        }

        if (playerData.getOwnedSubEquipmentIds().has(id)) {
            return {
                type: "select",
                label: Language.equipment(id, "label", equipment.label),
                onFocus: () => this.showDescription(this.describeSub(id, equipment)),
                onSelect: () => {
                    equip()
                    this.menu.back(1)
                },
            }
        }

        return {
            type: "submenu",
            label: `${Language.equipment(id, "label", equipment.label)}　<span class="equip-price">${Language.text("pollen")} ${equipment.price.toLocaleString()}</span>`,
            hides: ["equip-sub-options"],
            disabled: () => playerData.getTotalScore() < equipment.price,
            onFocus: () => this.showDescription(this.describeSub(id, equipment)),
            subMenu: () => ({
                ...MenuPreset.buildConfirmBox(
                    this.menu,
                    () => {
                        playerData.learnSubEquipment(id, equipment.price)
                        this.changed()
                        equip()
                        this.menu.back(1)
                    },
                    {
                        title: () => Language.text("learnEquip"),
                        elementId: "equip-learn",
                        // 題に値段まで入れるとスマホの幅からはみ出すので、払う量は「はい」の側に添える
                        confirmLabel: `${Language.text("yes")}　<span class="equip-price">${Language.text("pollen")} ${equipment.price.toLocaleString()}</span>`,
                        cancelLabel: Language.text("no"),
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
            ? Language.text("actionHintMobile")
            : Language.text("actionHintKeyboard", { key: InputCode.primaryLabel(App.settings.keyConfig.action) })
    }

    // 説明文。action入力で使う技には、使い方を続ける
    private describeSub(id: string, equipment: SubEquipment): string {
        const description = Language.equipment(id, "description", equipment.description)
        return equipment.manual ? `${description} ${this.actionHint()}` : description
    }

    private getSubLabel(): string {
        const subId = playerData.getLoadout().sub
        if (!subId) return Language.text("none")

        // 削除した技を装備したままの保存データもある。ゲームでは技なしとして扱われる(SceneGame)ので、表示もそれに合わせる
        const equipment = subEquipments[subId]
        return equipment ? Language.equipment(subId, "label", equipment.label) : Language.text("none")
    }
}
