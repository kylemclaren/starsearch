import type { Hit, IndexMeta, SearchEvent, Star } from "../../server/types"
export type { Hit, IndexMeta, SearchEvent, Star }

export type IndexEvent =
  | { type: "verify" }
  | { type: "verified"; verified: boolean }
  | { type: "embed"; done: number; total: number }
  | { type: "ready"; meta: IndexMeta }
  | { type: "error"; message: string }

async function* lines<T>(res: Response): AsyncGenerator<T> {
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let nl
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (line) yield JSON.parse(line) as T
    }
  }
  if (buf.trim()) yield JSON.parse(buf) as T
}

async function errorOf(res: Response) {
  const body = await res.json().catch(() => ({}))
  return new Error(body.error ?? `Server responded ${res.status}`)
}

export async function getMeta(login: string): Promise<IndexMeta | undefined> {
  const res = await fetch(`/api/users/${encodeURIComponent(login)}`)
  if (res.status === 404) return undefined
  if (!res.ok) throw await errorOf(res)
  return res.json()
}

export async function listRecent(): Promise<IndexMeta[]> {
  const res = await fetch("/api/users")
  return res.ok ? res.json() : []
}

export async function* uploadStars(login: string, stars: Star[], signal: AbortSignal): AsyncGenerator<IndexEvent> {
  const res = await fetch(`/api/users/${encodeURIComponent(login)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stars }),
    signal,
  })
  if (!res.ok) throw await errorOf(res)
  yield* lines<IndexEvent>(res)
}

export async function* search(login: string, q: string, lang: string | undefined, signal: AbortSignal): AsyncGenerator<SearchEvent> {
  const params = new URLSearchParams({ q })
  if (lang) params.set("lang", lang)
  const res = await fetch(`/api/users/${encodeURIComponent(login)}/search?${params}`, { signal })
  if (!res.ok) throw await errorOf(res)
  yield* lines<SearchEvent>(res)
}
