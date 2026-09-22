/**
 * Second pass: TypeSafe Jev judges every hybrid candidate against the query in
 * one request — a noul per repo ("would they want this one?") plus a choice
 * over all of them — and we re-sort by a blend of the two. Adapted from
 * jevsearch's server (github.com/kylemclaren/jevsearch).
 */
import type { Hit } from "./types"

const API_URL = process.env.TYPESAFE_API_URL ?? "https://api.typesafe.ai/v1/systemone"
const API_KEY = process.env.TYPESAFE_API_KEY ?? ""
const MODEL = process.env.TYPESAFE_MODEL ?? "jev-latest"
const THRESHOLD = 0.15
const RELEVANCE_WEIGHT = 0.75
const TIMEOUT_MS = 9000

interface Answer {
  noul?: number
  probabilities?: Record<string, number>
}
interface Response_ {
  model: string
  answers: Record<string, Answer>
  usage?: { input_tokens: number }
}

export interface JevRanking {
  hits: Hit[]
  demoted: Hit[]
  model: string
  judged: number
  inputTokens: number
  answerable: number
  tookMs: number
  cached: boolean
}

const cache = new Map<string, Omit<JevRanking, "cached">>()
function cacheSet(key: string, v: Omit<JevRanking, "cached">) {
  cache.set(key, v)
  if (cache.size > 2000) cache.delete(cache.keys().next().value!)
}

export async function judge(login: string, indexedAt: string, query: string, cands: Hit[], scope = ""): Promise<JevRanking> {
  const key = `${login}\u0000${indexedAt}\u0000${scope}\u0000${query.trim().toLowerCase().replace(/\s+/g, " ")}`
  const hit = cache.get(key)
  if (hit) return { ...hit, cached: true }
  const started = performance.now()
  if (cands.length === 0) return { hits: [], demoted: [], model: MODEL, judged: 0, inputTokens: 0, answerable: 0, tookMs: 0, cached: false }

  const state = {
    query,
    context: `These are GitHub repositories that ${login} has starred. The query is what ${login} (or someone browsing their stars) typed to find one.`,
    candidates: cands.map((h, i) => ({
      id: `c${i + 1}`,
      repo: h.id,
      description: h.description.slice(0, 280),
      topics: h.topics.slice(0, 8),
      language: h.language,
    })),
  }
  const questions: Record<string, unknown> = {}
  const options: Record<string, string> = {}
  cands.forEach((h, i) => {
    const id = `c${i + 1}`
    options[id] = `${h.id}${h.description ? ` — ${h.description.slice(0, 140)}` : ""}`
    questions[id] = {
      type: "noul",
      instructions: `Is candidate ${id} (${h.id}) a repository the searcher is looking for with this query?`,
      criteria: {
        true: "The repository is what the query describes: its purpose, kind of tool, domain or ecosystem matches",
        false: "The repository is about something else, or only shares a word or two with the query",
      },
    }
  })
  questions.best = { type: "choice", instructions: "Which candidate repository best matches the search query?", criteria: options }
  questions.answerable = { type: "noul", instructions: "Does at least one candidate repository match what the search query describes?" }

  const payload = JSON.stringify({ state, model: MODEL, questions })
  let body: Response_ | undefined
  let lastError: Error | undefined
  for (let attempt = 0; attempt < 3 && !body; attempt++) {
    if (attempt > 0) await Bun.sleep(200 * attempt * attempt)
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY || "gateway"}`, "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.ok) body = (await res.json()) as Response_
      else {
        lastError = new Error(`TypeSafe responded ${res.status} ${(await res.text()).slice(0, 200)}`)
        if (res.status === 401 || res.status === 422) break
      }
    } catch (err) {
      lastError = err as Error
    }
  }
  if (!body) throw lastError ?? new Error("TypeSafe call failed")

  const best = body.answers.best?.probabilities ?? {}
  const ranked = cands.map((h, i) => ({ ...h, relevance: body.answers[`c${i + 1}`]?.noul ?? 0, probability: best[`c${i + 1}`] ?? 0 }))
  const blend = (h: Hit) => RELEVANCE_WEIGHT * (h.relevance ?? 0) + (1 - RELEVANCE_WEIGHT) * (h.probability ?? 0)
  ranked.sort((a, b) => blend(b) - blend(a) || b.score - a.score)
  let kept = ranked.filter((h) => (h.relevance ?? 0) >= THRESHOLD)
  if (kept.length === 0) kept = ranked.slice(0, 3)
  const keptIds = new Set(kept.map((h) => h.id))

  const result = {
    hits: kept,
    demoted: ranked.filter((h) => !keptIds.has(h.id)),
    model: body.model ?? MODEL,
    judged: cands.length,
    inputTokens: body.usage?.input_tokens ?? 0,
    answerable: body.answers.answerable?.noul ?? 0,
    tookMs: Math.round(performance.now() - started),
  }
  cacheSet(key, result)
  return { ...result, cached: false }
}
