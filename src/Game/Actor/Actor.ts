import { vec, Vec } from "@ipota/vec"
import { IteratorManager } from "../IteratorManager"
import { Game } from "../Game"

export abstract class Actor {
    p: Vec = vec(0, 0)
    r: number = 8
    life = 1

    // この者を動かすスクリプト。毎フレーム一歩ずつ進む
    abstract readonly scripts: IteratorManager

    constructor(readonly game: Game) {}

    update() {
        this.scripts.update()
    }
}
