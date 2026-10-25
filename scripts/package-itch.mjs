import { execFileSync } from "node:child_process"
import { mkdirSync, existsSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const root = process.cwd()
const archive = resolve(root, "release/itch/The-Scattered-Days.zip")
const contents = ["index.html", "privacy.html", "manifest.webmanifest", "sw.js", "css", "assets", "dist"]

if (!existsSync(join(root, "dist/module/main.js"))) {
    throw new Error("Build output is missing. Run npm run build first.")
}

mkdirSync(dirname(archive), { recursive: true })
rmSync(archive, { force: true })
execFileSync("tar", ["-a", "-c", "-f", archive, ...contents], { cwd: root, stdio: "inherit" })

console.log(`Created ${archive}`)
