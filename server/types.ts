export interface Star {
  /** owner/name */
  id: string
  description: string
  stars: number
  language?: string
  topics: string[]
  homepage?: string
  archived: boolean
  fork: boolean
  starredAt?: string
  pushedAt?: string
}

export interface Hit extends Star {
  /** Reciprocal-rank-fusion score from the hybrid pass. */
  score: number
  /** Cosine similarity from the embedding pass. */
  similarity: number
  /** Which retrievers found it. */
  via: ("keyword" | "semantic")[]
  relevance?: number
  probability?: number
}

export interface IndexMeta {
  login: string
  count: number
  indexedAt: string
  verified: boolean
  languages: [string, number][]
}

export type SearchEvent =
  | { type: "hybrid"; query: string; hits: Hit[]; tookMs: number }
  | {
      type: "jev"
      query: string
      hits: Hit[]
      demoted: Hit[]
      model: string
      judged: number
      inputTokens: number
      answerable: number
      tookMs: number
      cached: boolean
    }
  | { type: "error"; query: string; message: string }
