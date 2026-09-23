import { embedDocuments, warm } from "./embed"
import { judge } from "./jev"
import { hybrid } from "./search"
import { embeddingText, listIndexes, loadIndex, saveIndex } from "./store"
import type { SearchEvent, Star } from "./types"

const PORT = Number(process.env.PORT ?? 8080)
const DIST = new URL("../dist/", import.meta.url).pathname
const LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i
const MAX_STARS = 20_000

const noStore = { "Cache-Control": "no-store" }
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: noStore })

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : ""
}

/** The browser did the GitHub fetching, so treat the upload as untrusted input. */
function sanitize(raw: unknown): Star[] | undefined {
  if (!Array.isArray(raw) || raw.length > MAX_STARS) return undefined
  const out: Star[] = []
  const seen = new Set<string>()
  for (const r of raw as Record<string, unknown>[]) {
    const id = str(r?.id, 200)
    if (!/^[\w.-]+\/[\w.-]+$/.test(id) || seen.has(id.toLowerCase())) continue
    seen.add(id.toLowerCase())
    out.push({
      id,
      description: str(r.description, 600),
      stars: Number.isFinite(r.stars) ? Math.max(0, Math.floor(r.stars as number)) : 0,
      language: str(r.language, 40) || undefined,
      topics: Array.isArray(r.topics) ? r.topics.slice(0, 20).map((t) => str(t, 50)).filter(Boolean) : [],
      homepage: /^https?:\/\//.test(str(r.homepage, 300)) ? str(r.homepage, 300) : undefined,
      archived: r.archived === true,
      fork: r.fork === true,
      starredAt: str(r.starredAt, 30) || undefined,
      pushedAt: str(r.pushedAt, 30) || undefined,
    })
  }
  return out
}

/**
 * One unauthenticated GitHub call per index: re-fetch the newest page of stars
 * and check the upload agrees with it. A rate-limited server can't verify, so
 * it accepts the upload but marks it unverified.
 */
async function verify(login: string, stars: Star[]): Promise<{ ok: boolean; verified: boolean; message?: string }> {
  try {
    const res = await fetch(`https://api.github.com/users/${login}/starred?per_page=30`, {
      headers: { "User-Agent": "stars-search", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 404) return { ok: false, verified: false, message: `GitHub has no user called ${login}` }
    if (!res.ok) return { ok: true, verified: false }
    const repos = (await res.json()) as { full_name: string }[]
    const uploaded = new Set(stars.map((s) => s.id.toLowerCase()))
    if (repos.length < 30 && stars.length > repos.length + 30)
      return { ok: false, verified: false, message: "The uploaded stars don't match GitHub" }
    if (repos.length === 0) return { ok: true, verified: true }
    const overlap = repos.filter((r) => uploaded.has(r.full_name.toLowerCase())).length / repos.length
    return overlap >= 0.8 ? { ok: true, verified: true } : { ok: false, verified: false, message: "The uploaded stars don't match GitHub" }
  } catch {
    return { ok: true, verified: false }
  }
}

const inflight = new Set<string>()

function ndjson(run: (send: (e: object) => void) => Promise<void>): Response {
  const enc = new TextEncoder()
  // The browser aborts a search as soon as the query changes, so writes after
  // that point must be dropped instead of throwing.
  let closed = false
  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      const send = (e: object) => {
        if (!closed) c.enqueue(enc.encode(JSON.stringify(e) + "\n"))
      }
      try {
        await run(send)
      } catch (err) {
        send({ type: "error", message: (err as Error).message })
      }
      if (!closed) {
        closed = true
        c.close()
      }
    },
    cancel() {
      closed = true
    },
  })
  return new Response(stream, { headers: { ...noStore, "Content-Type": "application/x-ndjson; charset=utf-8", "X-Accel-Buffering": "no" } })
}

async function indexUser(login: string, req: Request): Promise<Response> {
  if (inflight.has(login)) return json({ error: `${login} is already being indexed` }, 409)
  let body: { stars?: unknown }
  try {
    body = (await req.json()) as { stars?: unknown }
  } catch {
    return json({ error: "Expected JSON" }, 400)
  }
  const stars = sanitize(body.stars)
  if (!stars) return json({ error: `Expected up to ${MAX_STARS} stars` }, 400)

  inflight.add(login)
  return ndjson(async (send) => {
    try {
      send({ type: "verify" })
      const v = await verify(login, stars)
      if (!v.ok) throw new Error(v.message)
      const existing = await loadIndex(login)
      if (!v.verified && existing?.meta.verified)
        throw new Error("GitHub is rate-limiting this server, so the upload can't be checked. Try again later.")
      send({ type: "verified", verified: v.verified })
      let last = 0
      const vectors = await embedDocuments(stars.map(embeddingText), (done) => {
        if (done - last >= 128 || done === stars.length) {
          last = done
          send({ type: "embed", done, total: stars.length })
        }
      })
      const idx = await saveIndex(login, stars, vectors, v.verified)
      send({ type: "ready", meta: idx.meta })
    } finally {
      inflight.delete(login)
    }
  })
}

async function search(login: string, url: URL): Promise<Response> {
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 200)
  const language = url.searchParams.get("lang")?.slice(0, 40) || undefined
  const idx = await loadIndex(login)
  if (!idx) return json({ error: "not indexed" }, 404)
  if (!query) return json({ type: "hybrid", query, hits: [], tookMs: 0 })
  return ndjson(async (send: (e: SearchEvent) => void) => {
    const t0 = performance.now()
    const hits = await hybrid(idx, query, language)
    send({ type: "hybrid", query, hits, tookMs: Math.round(performance.now() - t0) })
    try {
      const r = await judge(login, idx.meta.indexedAt, query, hits, language)
      send({ type: "jev", query, ...r })
    } catch (err) {
      console.error(`jev failed for ${login} "${query}":`, (err as Error).message)
      send({ type: "error", query, message: (err as Error).message })
    }
  })
}

async function serveStatic(pathname: string): Promise<Response> {
  const safe = pathname.replace(/\.\.+/g, "").replace(/^\/+/, "")
  const file = Bun.file(DIST + (safe || "index.html"))
  if (safe && (await file.exists())) {
    const immutable = safe.startsWith("assets/")
    return new Response(file, { headers: { "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=300" } })
  }
  return new Response(Bun.file(DIST + "index.html"), { headers: { "Content-Type": "text/html; charset=utf-8", ...noStore } })
}

Bun.serve({
  port: PORT,
  idleTimeout: 120,
  maxRequestBodySize: 32 * 1024 * 1024,
  async fetch(req) {
    const url = new URL(req.url)
    const m = url.pathname.match(/^\/api\/users(?:\/([^/]+)(?:\/(search))?)?\/?$/)
    if (m) {
      const [, rawLogin, action] = m
      if (!rawLogin) return req.method === "GET" ? json(await listIndexes()) : json({ error: "Method not allowed" }, 405)
      if (!LOGIN_RE.test(rawLogin)) return json({ error: "That isn't a GitHub username" }, 400)
      const login = rawLogin.toLowerCase()
      if (action === "search") return search(login, url)
      if (req.method === "POST") return indexUser(login, req)
      const idx = await loadIndex(login)
      return idx ? json(idx.meta) : json({ error: "not indexed" }, 404)
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404)
    return serveStatic(url.pathname)
  },
})

warm().then(() => console.log("embedding model ready"))
console.log(`stars listening on :${PORT}`)
