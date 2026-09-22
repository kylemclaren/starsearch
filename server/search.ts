import { DIMS, embedQuery } from "./embed"
import type { UserIndex } from "./store"
import type { Hit } from "./types"

const RRF_K = 60

/**
 * Hybrid first pass: keyword (MiniSearch) and embedding (bge-small) retrieval,
 * merged with reciprocal rank fusion. Keyword catches exact names like
 * "bubbletea"; embeddings catch "that TUI thing for Go".
 */
export async function hybrid(idx: UserIndex, query: string, language?: string, limit = 30): Promise<Hit[]> {
  const pool = 60
  const allowed = (i: number) => !language || idx.stars[i]!.language === language
  const kw = idx.keyword.search(query, { filter: (r) => allowed(r.id as number) }).slice(0, pool)

  const q = await embedQuery(query)
  const n = idx.stars.length
  const sims = new Float32Array(n)
  const v = idx.vectors
  for (let i = 0; i < n; i++) {
    let dot = 0
    const off = i * DIMS
    for (let d = 0; d < DIMS; d++) dot += v[off + d]! * q[d]!
    sims[i] = dot
  }
  const dense = Array.from(sims.keys())
    .filter(allowed)
    .sort((a, b) => sims[b]! - sims[a]!)
    .slice(0, pool)

  const fused = new Map<number, { score: number; via: Set<"keyword" | "semantic"> }>()
  const add = (i: number, rank: number, via: "keyword" | "semantic") => {
    const e = fused.get(i) ?? { score: 0, via: new Set() }
    e.score += 1 / (RRF_K + rank + 1)
    e.via.add(via)
    fused.set(i, e)
  }
  kw.forEach((r, rank) => add(r.id as number, rank, "keyword"))
  dense.forEach((i, rank) => add(i, rank, "semantic"))

  return [...fused]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([i, e]) => ({ ...idx.stars[i]!, score: e.score, similarity: sims[i]!, via: [...e.via] }))
}
