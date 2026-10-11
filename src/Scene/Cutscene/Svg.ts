export namespace Svg {
    export const NS = "http://www.w3.org/2000/svg"

    // 中身をSVGの文字列で書いた<g>を作る
    export function g(className: string, content: string): SVGGElement {
        const el = document.createElementNS(NS, "g")
        el.setAttribute("class", className)
        el.innerHTML = content
        return el
    }

    // (x, y)へ動かし、deg度回し、横sx・縦syに伸ばす。回転と伸縮は(x, y)を中心にかかる
    export function place(el: SVGElement, x: number, y: number, deg: number, sx: number, sy: number) {
        el.setAttribute("transform", `translate(${x} ${y}) rotate(${deg}) scale(${sx} ${sy})`)
    }
}
