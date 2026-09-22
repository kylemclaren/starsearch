import MiniSearch from "minisearch"
import { mkdir, readdir, readFile, writeFile, rename } from "node:fs/promises"
import { DIMS, EMBED_MODEL } from "./embed"
import type { IndexMeta, Star } from "./types"

const DIR = new URL("../data/users/", import.meta.url).pathname

export interface UserIndex {
  meta: IndexMeta
  stars: Star[]
  vectors: Float32Array
  keyword: MiniSearch<KeywordDoc>
}

interface KeywordDoc {
  i: number
  name: string
  owner: string
  description: string
  topics: string
  language: string
}

export function embeddingText(s: Star): string {
  const [owner, name] = s.id.split("/")
  const words = (name ?? "").replace(/[-_.]+/g, " ")
  const parts = [`${words} by ${owner}.`, s.description]
  if (s.topics.length) parts.push(`Topics: ${s.topics.join(", ")}.`)
  if (s.language) parts.push(`Written in ${s.language}.`)
  return parts.filter(Boolean).join(" ")
}

function buildKeyword(stars: Star[]) {
  const ms = new MiniSearch<KeywordDoc>({
    idField: "i",
    fields: ["name", "owner", "description", "topics", "language"],
    storeFields: [],
    // Split repo names on dashes, dots and camelCase so "bubbletea" and "bubble-tea" both land.
    tokenize: (text) =>
      text
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .split(/[\s\-_.,:;/()[\]{}"'!?+#@]+/)
        .filter(Boolean),
    searchOptions: {
      boost: { name: 3, topics: 2, description: 1.5, owner: 1, language: 1 },
      prefix: (term) => term.length > 3,
      fuzzy: (term) => (term.length > 5 ? 0.15 : false),
      combineWith: "OR",
    },
  })
  ms.addAll(
    stars.map((s, i) => {
      const [owner = "", name = ""] = s.id.split("/")
      return { i, name: `${name} ${name.replace(/[-_.]+/g, " ")}`, owner, description: s.description, topics: s.topics.join(" ").replace(/-/g, " "), language: s.language ?? "" }
    }),
  )
  return ms
}

function languages(stars: Star[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const s of stars) if (s.language) counts.set(s.language, (counts.get(s.language) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])
}

const loaded = new Map<string, UserIndex>()
const MAX_LOADED = 24

function remember(idx: UserIndex) {
  loaded.delete(idx.meta.login)
  loaded.set(idx.meta.login, idx)
  if (loaded.size > MAX_LOADED) loaded.delete(loaded.keys().next().value!)
}

export async function saveIndex(login: string, stars: Star[], vectors: Float32Array, verified: boolean): Promise<UserIndex> {
  await mkdir(DIR, { recursive: true })
  const meta: IndexMeta = { login, count: stars.length, indexedAt: new Date().toISOString(), verified, languages: languages(stars) }
  const base = DIR + login
  await writeFile(base + ".bin.tmp", new Uint8Array(vectors.buffer, vectors.byteOffset, vectors.byteLength))
  await writeFile(base + ".json.tmp", JSON.stringify({ meta, model: EMBED_MODEL, stars }))
  await rename(base + ".bin.tmp", base + ".bin")
  await rename(base + ".json.tmp", base + ".json")
  await writeFile(base + ".meta", JSON.stringify(meta))
  const idx = { meta, stars, vectors, keyword: buildKeyword(stars) }
  remember(idx)
  return idx
}

export async function loadIndex(login: string): Promise<UserIndex | undefined> {
  const hit = loaded.get(login)
  if (hit) {
    remember(hit)
    return hit
  }
  try {
    const raw = JSON.parse(await readFile(DIR + login + ".json", "utf8"))
    if (raw.model !== EMBED_MODEL) return undefined
    const buf = await readFile(DIR + login + ".bin")
    const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
    if (vectors.length !== raw.stars.length * DIMS) return undefined
    const idx = { meta: raw.meta, stars: raw.stars, vectors, keyword: buildKeyword(raw.stars) }
    remember(idx)
    return idx
  } catch {
    return undefined
  }
}

/** Recently indexed users, newest first, for the home page. */
export async function listIndexes(limit = 12): Promise<IndexMeta[]> {
  try {
    const files = (await readdir(DIR)).filter((f) => f.endsWith(".meta"))
    const metas = await Promise.all(
      files.map(async (f) => {
        try {
          return JSON.parse(await readFile(DIR + f, "utf8")) as IndexMeta
        } catch {
          return undefined
        }
      }),
    )
    return metas
      .filter((m): m is IndexMeta => !!m)
      .sort((a, b) => b.indexedAt.localeCompare(a.indexedAt))
      .slice(0, limit)
      .map((m) => ({ ...m, languages: m.languages.slice(0, 3) }))
  } catch {
    return []
  }
}
