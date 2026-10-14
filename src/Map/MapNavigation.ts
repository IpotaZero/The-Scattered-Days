import { MapNode } from "./MapGraph"

export type Direction = "up" | "down" | "left" | "right"

// 方向キーで隣のノードへ移る先を選ぶ
export namespace MapNavigation {
    const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
    }

    // 現在ノードから見て、押した方向に最も近い(角度が小さい)隣接ノードを選ぶ
    export function pickClosestInDirection(
        current: MapNode,
        neighbors: MapNode[],
        direction: Direction,
    ): MapNode | undefined {
        const vector = DIRECTION_VECTORS[direction]
        let best: MapNode | undefined
        let bestDot = -Infinity

        for (const neighbor of neighbors) {
            const dx = neighbor.x - current.x
            const dy = neighbor.y - current.y
            const len = Math.hypot(dx, dy)
            if (len === 0) continue

            const dot = (dx / len) * vector.x + (dy / len) * vector.y
            if (dot < 0.5) continue // 押した方向から60度を超えて外れているノードは候補にしない

            if (dot > bestDot) {
                bestDot = dot
                best = neighbor
            }
        }

        return best
    }
}
