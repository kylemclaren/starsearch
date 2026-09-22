import { useEffect, useState } from "react"
import { listRecent, type IndexMeta } from "./api"
import { navigate } from "./router"
import { UsernameForm } from "./UsernameForm"
import { Avatar, GitHubLink, Tile, ago, langColor } from "./ui"

export function Home() {
  const [recent, setRecent] = useState<IndexMeta[]>()
  useEffect(() => {
    listRecent().then(setRecent)
  }, [])
  const total = recent?.reduce((a, m) => a + m.count, 0) ?? 0

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-[1200px] items-center justify-end px-4 sm:px-6">
        <GitHubLink />
      </header>

      <section className="relative mx-auto flex max-w-[1280px] flex-col items-center px-4 pb-20 pt-12 text-center sm:pt-20">
        {total > 0 && (
          <span className="pill fade-in mb-6">
            <span className="tabular-nums text-ink">{total.toLocaleString()}</span> stars indexed
          </span>
        )}
        <h1 className="max-w-[640px] text-balance text-[40px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[56px]">
          Search anyone’s GitHub stars in plain words.
        </h1>
        <p className="mt-5 max-w-[500px] text-pretty text-[17px] leading-relaxed text-dim">
          Describe the repo you half-remember. Keyword and semantic retrieval find the candidates, then TypeSafe’s Jev judges which ones you meant.
        </p>
        <div className="mt-10 flex w-full justify-center">
          <UsernameForm autoFocus />
        </div>
        <p className="mt-4 text-[13px] text-mute">Public stars only. Your browser fetches them from GitHub directly, no login.</p>
      </section>

      {recent && recent.length > 0 && (
        <section className="mx-auto max-w-[680px] px-4 pb-24 sm:px-6">
          <Tile inner="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <h2 className="text-[13px] font-medium text-ink">Recently indexed</h2>
              <span className="text-[12px] text-mute tabular-nums">
                {recent.length} {recent.length === 1 ? "person" : "people"} · {total.toLocaleString()} stars
              </span>
            </div>
            <ul className="divide-y divide-line">
              {recent.map((m) => (
                <li key={m.login} className="fade-in">
                  <a
                    href={`/${m.login}`}
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(`/${m.login}`)
                    }}
                    className="group flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.025]"
                  >
                    <Avatar owner={m.login} size={40} className="rounded-full" />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[15px] font-medium">{m.login}</span>
                        <span className="shrink-0 text-[12px] text-mute">{ago(m.indexedAt)}</span>
                      </div>
                      <LanguageBar meta={m} />
                    </div>
                    <svg viewBox="0 0 16 16" width="14" height="14" className="shrink-0 text-mute transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden>
                      <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </Tile>
        </section>
      )}

      <footer className="mx-auto max-w-[1200px] px-4 pb-10 text-center text-[12.5px] text-mute sm:px-6">
        Retrieval: MiniSearch + bge-small embeddings, fused with RRF. Re-ranking:{" "}
        <a className="text-dim underline decoration-line-2 underline-offset-4 hover:text-ink" href="https://typesafe.ai" target="_blank" rel="noreferrer">
          TypeSafe Jev
        </a>
        , after{" "}
        <a className="text-dim underline decoration-line-2 underline-offset-4 hover:text-ink" href="https://github.com/kylemclaren/jevsearch" target="_blank" rel="noreferrer">
          jevsearch
        </a>
        .
      </footer>
    </div>
  )
}

/** Share of the top languages across someone's stars, GitHub-style. */
function LanguageBar({ meta }: { meta: IndexMeta }) {
  const top = meta.languages.slice(0, 4)
  const rest = Math.max(0, meta.count - top.reduce((a, [, n]) => a + n, 0))
  return (
    <div className="mt-2">
      <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-white/5">
        {top.map(([l, n]) => (
          <span key={l} style={{ width: `${(n / meta.count) * 100}%`, background: langColor(l) }} />
        ))}
        {rest > 0 && <span className="bg-white/10" style={{ width: `${(rest / meta.count) * 100}%` }} />}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-mute">
        <span className="text-dim tabular-nums">{meta.count.toLocaleString()} stars</span>
        {top.slice(0, 3).map(([l, n]) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: langColor(l) }} />
            {l}
            <span className="tabular-nums opacity-70">{Math.round((n / meta.count) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}
