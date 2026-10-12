export type AtlasUv = {
    u0: number
    v0: number
    u1: number
    v1: number
}

/**
 * 弾のスプライト（見た目ごとに1枚のオフスクリーンcanvas）を
 * 1枚の大きなテクスチャに敷き詰めて使い回すためのクラス。
 * 同じキー（appearance, color, r）はテクスチャへの再アップロードをしない。
 * スプライトは横に並べる段に置く。段の高さは√2倍ずつの刻みのどれかで、同じ刻みのスプライトだけを並べる。
 */
export class BulletSpriteAtlas {
    // ステージをまたいで使い回すので、色違いの弾が増えても溢れにくいよう大きめにとる
    static readonly SIZE = 2048

    private readonly slots = new Map<string, AtlasUv>()

    // 置き場所がなかったキー。同じキーの注意は1度だけconsoleに出る
    private readonly overflowedKeys = new Set<string>()

    private readonly shelves: { y: number; height: number; x: number }[] = []
    private nextShelfY = 0

    constructor(
        private readonly gl: WebGL2RenderingContext,
        readonly texture: WebGLTexture,
    ) {
        this.allocate()
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }

    // テクスチャを透明な SIZE 四方で作り直す
    private allocate() {
        const gl = this.gl
        gl.bindTexture(gl.TEXTURE_2D, this.texture)
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            BulletSpriteAtlas.SIZE,
            BulletSpriteAtlas.SIZE,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
        )
    }

    // 段が高さの半分を超えて積まれているか
    isCrowded() {
        return this.nextShelfY > BulletSpriteAtlas.SIZE / 2
    }

    // 置いたスプライトをすべて忘れ、テクスチャを透明にする。忘れたスプライトは、次に get() に来たときに置き直される。
    // queue してから描くまでの間に呼ぶと、その間に積んだ弾は消えたスプライトの場所を描いてしまう
    clear() {
        this.slots.clear()
        this.overflowedKeys.clear()
        this.shelves.length = 0
        this.nextShelfY = 0
        this.allocate()
    }

    /**
     * keyに対応するUV領域を返す。未登録ならsourceを新しい領域へ焼き込む。
     * アトラスが満杯で置き場所がない場合はnullを返す（呼び出し側はCanvas2Dへフォールバックする）。
     */
    get(key: string, source: HTMLCanvasElement): AtlasUv | null {
        const cached = this.slots.get(key)
        if (cached) return cached

        const pos = this.pack(source.width, source.height)
        if (!pos) {
            this.warnOverflow(key, source)
            return null
        }

        const gl = this.gl
        gl.bindTexture(gl.TEXTURE_2D, this.texture)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
        gl.texSubImage2D(gl.TEXTURE_2D, 0, pos.x, pos.y, gl.RGBA, gl.UNSIGNED_BYTE, source)

        const uv: AtlasUv = {
            u0: pos.x / BulletSpriteAtlas.SIZE,
            v0: pos.y / BulletSpriteAtlas.SIZE,
            u1: (pos.x + source.width) / BulletSpriteAtlas.SIZE,
            v1: (pos.y + source.height) / BulletSpriteAtlas.SIZE,
        }
        this.slots.set(key, uv)
        return uv
    }

    // 溢れたスプライトは毎フレーム get() に来るので、キーごとに最初の1回だけ出す
    private warnOverflow(key: string, source: HTMLCanvasElement) {
        if (this.overflowedKeys.has(key)) return
        this.overflowedKeys.add(key)

        console.warn(
            `弾のテクスチャ(${BulletSpriteAtlas.SIZE}px四方)が溢れたため、この弾はCanvas2Dで直接描かれます: ` +
                `${key} (${source.width}x${source.height}px, 登録済み${this.slots.size}枚)`,
        )
    }

    // 高さ h を√2倍ずつの刻みに切り上げた段のうち、横に空きのある段の右端に置く。
    // そのような段がなければ新しい段を積み、それも積めなければ、h より高い段の空きに置く
    private pack(w: number, h: number): { x: number; y: number } | null {
        if (w > BulletSpriteAtlas.SIZE) return null

        const height = Math.ceil(2 ** (Math.ceil(Math.log2(Math.max(h, 1)) * 2) / 2))
        const shelf =
            this.shelves.find((s) => s.height === height && s.x + w <= BulletSpriteAtlas.SIZE) ??
            this.stackShelf(height) ??
            this.shelves.find((s) => h <= s.height && s.x + w <= BulletSpriteAtlas.SIZE)
        if (!shelf) return null

        const pos = { x: shelf.x, y: shelf.y }
        shelf.x += w
        return pos
    }

    // 高さ height の空の段を一番上に積む。テクスチャの高さを超えるなら積まない
    private stackShelf(height: number) {
        if (this.nextShelfY + height > BulletSpriteAtlas.SIZE) return undefined

        const shelf = { y: this.nextShelfY, height, x: 0 }
        this.shelves.push(shelf)
        this.nextShelfY += height
        return shelf
    }
}
