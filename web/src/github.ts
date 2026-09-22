/**
 * Fetches a user's public stars straight from the visitor's browser, using
 * GitHub's unauthenticated REST API. Each visitor spends their own 60
 * requests an hour (100 stars per request), never a shared token.
 */
import type { Star } from "../../server/types"

export interface FetchProgress {
  page: number
  pages: number
  count: number
  remaining?: number
}

export class GitHubError extends Error {
  constructor(message: string, public resetAt?: Date) {
    super(message)
  }
}

const MAX_PAGES = 200
const CONCURRENCY = 6

interface StarredItem {
  starred_at: string
  repo: {
    full_name: string
    description: string | null
    stargazers_count: number
    language: string | null
    topics?: string[]
    homepage: string | null
    archived: boolean
    fork: boolean
    pushed_at: string
  }
}

function toStar({ starred_at, repo }: StarredItem): Star {
  return {
    id: repo.full_name,
    description: repo.description ?? "",
    stars: repo.stargazers_count,
    language: repo.language ?? undefined,
    topics: repo.topics ?? [],
    homepage: repo.homepage || undefined,
    archived: repo.archived,
    fork: repo.fork,
    starredAt: starred_at,
    pushedAt: repo.pushed_at,
  }
}

async function page(login: string, n: number, signal: AbortSignal) {
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/starred?per_page=100&page=${n}`, {
    headers: { Accept: "application/vnd.github.star+json" },
    signal,
  })
  const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? NaN)
  if (res.status === 404) throw new GitHubError(`GitHub has no user called “${login}”.`)
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset"))
    throw new GitHubError("GitHub's hourly limit for unauthenticated requests from your network is used up.", reset ? new Date(reset * 1000) : undefined)
  }
  if (!res.ok) throw new GitHubError(`GitHub responded ${res.status}.`)
  const items = (await res.json()) as StarredItem[]
  const last = res.headers.get("link")?.match(/[?&]page=(\d+)>; rel="last"/)?.[1]
  return { stars: items.map(toStar), last: last ? Number(last) : n, remaining: Number.isNaN(remaining) ? undefined : remaining, reset: Number(res.headers.get("x-ratelimit-reset")) }
}

export async function fetchStars(login: string, onProgress: (p: FetchProgress) => void, signal: AbortSignal): Promise<Star[]> {
  const first = await page(login, 1, signal)
  const pages = Math.min(first.last, MAX_PAGES)
  let remaining = first.remaining
  if (remaining !== undefined && pages - 1 > remaining) {
    throw new GitHubError(
      `${login} has about ${(pages * 100).toLocaleString()} stars, which takes ${pages} GitHub requests. Your network has ${remaining} left this hour.`,
      first.reset ? new Date(first.reset * 1000) : undefined,
    )
  }
  const byPage: Star[][] = [first.stars]
  let done = 1
  let count = first.stars.length
  onProgress({ page: done, pages, count, remaining })

  let next = 2
  async function worker() {
    while (next <= pages) {
      const n = next++
      const r = await page(login, n, signal)
      byPage[n - 1] = r.stars
      done++
      count += r.stars.length
      if (r.remaining !== undefined) remaining = Math.min(remaining ?? Infinity, r.remaining)
      onProgress({ page: done, pages, count, remaining })
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return byPage.flat()
}
