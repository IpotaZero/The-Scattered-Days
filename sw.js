// 同一オリジンのGETはまずネットワークに取りに行き、取れたものをキャッシュに入れる。ネットワークに繋がらないときはキャッシュから返す
const CACHE = "the-scattered-days"

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))

// <audio>は曲の一部分だけを要求(Range)して、少しずつ読む。一部分の応答(206)はキャッシュに入れられないので、
// オンラインならそのままネットワークに取りに行って返し、あわせて曲の全文をキャッシュに入れておく。
// ネットワークに繋がらないときは、キャッシュの全文から要求された部分を切り出して返す
const RangeResponder = {
    // 全文を取りに行っている最中のURL
    caching: new Set(),

    async respond(e) {
        try {
            const res = await fetch(e.request)
            if (res.ok) e.waitUntil(RangeResponder.cacheWhole(e.request.url))
            return res
        } catch {
            const whole = await caches.match(e.request.url)
            return whole ? RangeResponder.slice(whole, e.request.headers.get("range")) : Response.error()
        }
    },

    async cacheWhole(url) {
        if (RangeResponder.caching.has(url)) return

        RangeResponder.caching.add(url)
        try {
            const cache = await caches.open(CACHE)
            if (await cache.match(url)) return

            const res = await fetch(url)
            if (res.ok) await cache.put(url, res)
        } finally {
            RangeResponder.caching.delete(url)
        }
    },

    // "bytes=開始-終了"(終了は省略可)と"bytes=-末尾から何バイト"の形に対応する
    async slice(whole, range) {
        const bytes = await whole.arrayBuffer()
        const total = bytes.byteLength
        const match = /^bytes=(\d*)-(\d*)$/.exec(range ?? "")
        if (!match || (match[1] === "" && match[2] === "")) return new Response(bytes)

        const start = match[1] === "" ? Math.max(0, total - Number(match[2])) : Number(match[1])
        const end = match[1] === "" || match[2] === "" ? total - 1 : Math.min(Number(match[2]), total - 1)
        if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } })

        return new Response(bytes.slice(start, end + 1), {
            status: 206,
            headers: {
                "Content-Type": whole.headers.get("Content-Type") ?? "application/octet-stream",
                "Content-Range": `bytes ${start}-${end}/${total}`,
            },
        })
    },
}

self.addEventListener("fetch", (e) => {
    const url = new URL(e.request.url)
    if (e.request.method !== "GET" || url.origin !== self.location.origin) return

    if (e.request.headers.has("range")) {
        e.respondWith(RangeResponder.respond(e))
        return
    }

    e.respondWith(
        fetch(e.request)
            .then((res) => {
                if (res.ok) {
                    const copy = res.clone()
                    e.waitUntil(caches.open(CACHE).then((cache) => cache.put(e.request, copy)))
                }
                return res
            })
            .catch(() => caches.match(e.request).then((cached) => cached ?? Response.error())),
    )
})
