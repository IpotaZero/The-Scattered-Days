import { execFileSync } from "node:child_process"
import { mkdtempSync, cpSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const run = (cwd, ...args) => execFileSync("git", args, { cwd, stdio: "inherit" })

const root = process.cwd()
const remote = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root }).toString().trim()

execFileSync("npx", ["vite", "build"], { cwd: root, stdio: "inherit", shell: true })

// index.html・manifest・sw.js・css・assets・distをそのままの配置で一時ディレクトリに写し、新規リポジトリにしてgh-pagesへ強制pushする
const tmp = mkdtempSync(join(tmpdir(), "deploy-"))
try {
    for (const name of ["index.html", "manifest.webmanifest", "sw.js", "css", "assets", "dist"]) {
        cpSync(join(root, name), join(tmp, name), {
            recursive: true,
            filter: (src) => !src.includes(".obsidian"),
        })
    }
    writeFileSync(join(tmp, ".nojekyll"), "")
    run(tmp, "init", "-q", "-b", "gh-pages")
    run(tmp, "add", "-A")
    run(tmp, "commit", "-q", "-m", "deploy")
    run(tmp, "push", "-f", remote, "gh-pages")
} finally {
    rmSync(tmp, { recursive: true, force: true })
}
