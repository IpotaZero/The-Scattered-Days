// 同一オリジンのGETはまずネットワークに取りに行き、取れたものをキャッシュに入れる。ネットワークに繋がらないときはキャッシュから返す
const CACHE = "the-scattered-days"

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))

self.addEventListener("fetch", (e) => {
    const url = new URL(e.request.url)
    if (e.request.method !== "GET" || url.origin !== self.location.origin) return

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
