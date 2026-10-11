// マップ(assets/MapData/MapData.canvas)をJSで編集する。ここに編集を書いて `npm run map` で実行する。
// 例: map.nodes.find((node) => node.text.includes("StageA")).x += 260

import { readFile, writeFile } from "node:fs/promises"

const path = new URL("../assets/MapData/MapData.canvas", import.meta.url)
const map = JSON.parse(await readFile(path, "utf8"))

const d = 80
const d2 = 160

// フォーマット
map.nodes.forEach((node) => {
    node.width = Math.round(node.width / d2) * d2
    node.height = node.width

    const centerX = node.x + node.width / 2
    const centerY = node.y + node.height / 2

    const formattedCenterX = Math.floor(centerX / d) * d
    const formattedCenterY = Math.floor(centerY / d) * d

    node.x = formattedCenterX - node.width / 2
    node.y = formattedCenterY - node.height / 2
})

// Obsidianが書き出すのと同じ形にして、差分を小さく保つ
const lines = (items) => items.map((item) => `\t\t${JSON.stringify(item)}`).join(",\n")
await writeFile(path, `{\n\t"nodes":[\n${lines(map.nodes)}\n\t],\n\t"edges":[\n${lines(map.edges)}\n\t]\n}`)
