import { EquipmentId } from "../../Data/Equipment"
import { barrier } from "./Sub/Barrier"
import { dash } from "./Sub/Dash"
import { extraLife } from "./Sub/ExtraLife"
import { laser } from "./Main/Laser"
import { needle } from "./Sub/Needle"
import { standard } from "./Main/Standard"
import { sweep } from "./Sub/Sweep"
import type { MainEquipment, SubEquipment } from "./types"

export type { MainEquipment, SubEquipment }

export const mainEquipments: Record<EquipmentId, MainEquipment> = {
    standard,
    laser,
}

export const subEquipments: Record<EquipmentId, SubEquipment> = {
    dash,
    sweep,
    needle,
    extraLife,
    barrier,
}
