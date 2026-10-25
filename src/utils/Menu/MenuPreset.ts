import type { Menu, MenuOptionBox, MenuSoundPattern } from "./Menu"

export namespace MenuPreset {
    export const buildConfirmBox = (
        menu: Menu,
        onConfirm: () => void,
        {
            title,
            elementId,
            confirmSound,
            confirmLabel,
            cancelLabel,
        }: { title: () => string; elementId: string; confirmSound?: MenuSoundPattern; confirmLabel: string; cancelLabel: string },
    ): MenuOptionBox => ({
        elementId,
        title,
        options: () => [
            [
                {
                    type: "select",
                    label: confirmLabel,
                    sound: confirmSound,
                    onSelect: () => {
                        onConfirm()
                    },
                },
            ],
            [
                {
                    type: "select",
                    label: cancelLabel,
                    sound: "cancel",
                    onSelect: () => {
                        menu.back(1)
                    },
                },
            ],
        ],
    })
}
