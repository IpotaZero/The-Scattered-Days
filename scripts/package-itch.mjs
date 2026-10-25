import { execFileSync } from "node:child_process"
import { mkdirSync, existsSync, rmSync, cpSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const root = process.cwd()
const archive = resolve(root, "release/itch/The-Scattered-Days.zip")
const contents = ["index.html", "privacy.html", "manifest.webmanifest", "sw.js", "css", "assets", "dist"]

if (!existsSync(join(root, "dist/module/main.js"))) {
    throw new Error("Build output is missing. Run npm run build first.")
}

mkdirSync(dirname(archive), { recursive: true })
rmSync(archive, { force: true })

if (process.platform === "win32") {
    const staging = join(dirname(archive), `.itch-package-${process.pid}`)
    mkdirSync(staging)
    try {
        for (const path of contents) cpSync(join(root, path), join(staging, path), { recursive: true })

        const quote = (path) => `'${path.replaceAll("'", "''")}'`
        const command = [
            "Add-Type -AssemblyName System.IO.Compression",
            `$sourceRoot = ${quote(staging)}`,
            `$destination = ${quote(archive)}`,
            "$archiveStream = [System.IO.File]::Open($destination, [System.IO.FileMode]::Create)",
            "$zip = [System.IO.Compression.ZipArchive]::new($archiveStream, [System.IO.Compression.ZipArchiveMode]::Create)",
            "try { Get-ChildItem -LiteralPath $sourceRoot -File -Recurse | ForEach-Object {",
            "$entryName = $_.FullName.Substring($sourceRoot.Length).TrimStart([char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)).Replace([IO.Path]::DirectorySeparatorChar, '/')",
            "$entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)",
            "$sourceStream = [System.IO.File]::OpenRead($_.FullName)",
            "$entryStream = $entry.Open()",
            "try { $sourceStream.CopyTo($entryStream) } finally { $entryStream.Dispose(); $sourceStream.Dispose() }",
            "} } finally { $zip.Dispose() }",
        ].join("; ")
        execFileSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], {
            cwd: root,
            stdio: "inherit",
        })
    } finally {
        rmSync(staging, { recursive: true, force: true })
    }
} else {
    execFileSync("zip", ["-r", "-FS", archive, ...contents], { cwd: root, stdio: "inherit" })
}

console.log(`Created ${archive}`)
