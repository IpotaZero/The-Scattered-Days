import type { Polygon } from "../../BulletDrawer/Polygon"

// 弾の見た目と当たり判定の組。Bullet は見た目と当たり判定を別々には持たず、この組を一つ持つ
export namespace Shape {
    export type Appearance =
        | "donut"
        | "ball"
        | "line"
        | "arrow"
        /** 画面上の二点を結ぶ線分型の攻撃 */
        | "laser"
        /** 砲塔から延びる半直線型の攻撃 */
        | "beam"
        | "player"
        | "score"
        | Polygon.Type

    export type Collision = "circle" | "line" | "arrow" | "rect" | Polygon.Type

    export type Type = { readonly appearance: Appearance; readonly collision: Collision }

    export const donut: Type = { appearance: "donut", collision: "circle" }
    export const ball: Type = { appearance: "ball", collision: "circle" }
    export const line: Type = { appearance: "line", collision: "line" }
    export const arrow: Type = { appearance: "arrow", collision: "arrow" }
    // 始点 p から radian の向きへ length だけ延びる、太さ r * 2 の長方形
    export const laser: Type = { appearance: "laser", collision: "rect" }
    // laser と同じ長方形に、根元の光が付く
    export const beam: Type = { appearance: "beam", collision: "rect" }
    export const player: Type = { appearance: "player", collision: "circle" }
    export const score: Type = { appearance: "score", collision: "circle" }
    export const wedge: Type = { appearance: "wedge", collision: "wedge" }
    export const diamond: Type = { appearance: "diamond", collision: "diamond" }
    export const triangle: Type = { appearance: "triangle", collision: "triangle" }
}
