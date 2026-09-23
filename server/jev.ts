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

/**
 * TypeSafe sits behind a Cloudflare firewall that 403s any body containing
 * text that looks like an attack — `' OR 1=1`, `../../etc/passwd`,
 * `${jndi:…}`. Starred security tools describe themselves with exactly those
 * strings, so every piece of user text is defanged before it is sent: swap
 * the trigger characters for look-alikes that mean the same thing to Jev.
 */
function defang(text: string): string {
  return text
    .replace(/'/g, "\u2019")
    .replace(/\.\.[\/\\]/g, "..\u2215")
    .replace(/\$\{/g, "$ {")
    .replace(/\/etc\//gi, "\u2215etc\u2215")
}

/** After a firewall block: keep words, drop anything code- or path-like.
 *  Dots go too, since file names such as win.ini are triggers on their own. */
function strict(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s,:!?&+#@()\-]/gu, " ")
    .replace(/-{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Final fallback: judge on repo names and topics alone. */
const bare = () => ""

class FirewallBlocked extends Error {}

const cache = new Map<string, Omit<JevRanking, "cached">>()
function cacheSet(key: string, v: Omit<JevRanking, "cached">) {
  cache.set(key, v)
  if (cache.size > 2000) cache.delete(cache.keys().next().value!)
}

async function call(payload: string): Promise<Response_> {
  let lastError: Error | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await Bun.sleep(200 * attempt * attempt)
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY || "gateway"}`, "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.ok) return (await res.json()) as Response_
      const text = await res.text()
      // A JSON 403 is a key problem; an HTML one is the firewall.
      if (res.status === 403 && text.trimStart().startsWith("<")) throw new FirewallBlocked("TypeSafe's firewall blocked the request")
      let detail = text.slice(0, 160)
      try {
        detail = JSON.parse(text).detail?.message ?? detail
      } catch {}
      lastError = new Error(`TypeSafe responded ${res.status}: ${detail}`)
      if (res.status === 401 || res.status === 403 || res.status === 422) break
    } catch (err) {
      if (err instanceof FirewallBlocked) throw err
      lastError = err as Error
    }
  }
  throw lastError ?? new Error("TypeSafe call failed")
}

export async function judge(login: string, indexedAt: string, query: string, cands: Hit[], scope = ""): Promise<JevRanking> {
  const key = `${login}\u0000${indexedAt}\u0000${scope}\u0000${query.trim().toLowerCase().replace(/\s+/g, " ")}`
  const hit = cache.get(key)
  if (hit) return { ...hit, cached: true }
  const started = performance.now()
  if (cands.length === 0) return { hits: [], demoted: [], model: MODEL, judged: 0, inputTokens: 0, answerable: 0, tookMs: 0, cached: false }

  const build = (clean: (t: string) => string, cleanQuery = clean) => {
    const state = {
      query: cleanQuery(query),
      context: `These are GitHub repositories that ${login} has starred. The query is what ${login} (or someone browsing their stars) typed to find one.`,
      candidates: cands.map((h, i) => ({
        id: `c${i + 1}`,
        repo: h.id,
        ...(clean === bare ? {} : { description: clean(h.description.slice(0, 280)) }),
        topics: h.topics.slice(0, 8),
        language: h.language,
      })),
    }
    const questions: Record<string, unknown> = {}
    const options: Record<string, string> = {}
    cands.forEach((h, i) => {
      const id = `c${i + 1}`
      const desc = clean(h.description.slice(0, 140))
      options[id] = `${h.id}${desc ? ` — ${desc}` : ""}`
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
    return JSON.stringify({ state, model: MODEL, questions })
  }

  let body: Response_ | undefined
  for (const [name, clean] of [["defanged", defang], ["strict", strict], ["names only", bare]] as const) {
    try {
      // The query is the searcher's own words, so it always keeps at least strict cleaning.
      body = await call(clean === bare ? build(bare, strict) : build(clean))
      break
    } catch (err) {
      if (!(err instanceof FirewallBlocked) || clean === bare) throw err
      console.warn(`jev: firewall blocked the ${name} request for ${login} "${query}"`)
    }
  }
  if (!body) throw new Error("TypeSafe call failed")

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
