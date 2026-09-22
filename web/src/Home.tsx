import { useEffect, useState } from "react"
import { listRecent, type IndexMeta } from "./api"
import { navigate } from "./router"
import { UsernameForm } from "./UsernameForm"
import { Avatar, Tile, ago, compact, langColor } from "./ui"

export function Home() {
  const [recent, setRecent] = useState<IndexMeta[]>()
  useEffect(() => {
    listRecent().then(setRecent)
  }, [])
  const total = recent?.reduce((a, m) => a + m.count, 0) ?? 0

  return (
    <div className="min-h-dvh">
      <section className="relative mx-auto flex max-w-[1280px] flex-col items-center px-4 pb-24 pt-24 text-center sm:pt-36">
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
        <section className="mx-auto max-w-[1000px] px-4 pb-24 sm:px-6">
          <h2 className="mb-4 text-center text-[13px] text-mute">Recently indexed</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((m) => (
              <a
                key={m.login}
                href={`/${m.login}`}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(`/${m.login}`)
                }}
                className="group fade-in"
              >
                <Tile inner="flex items-center gap-3 p-4 transition group-hover:bg-tile-2">
                  <Avatar owner={m.login} size={40} className="rounded-[12px]" />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate font-medium">{m.login}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-mute">
                      <span className="tabular-nums">{compact(m.count)} stars</span>
                      <span>·</span>
                      <span>{ago(m.indexedAt)}</span>
                    </div>
                  </div>
                  <div className="flex -space-x-1" title={m.languages.map(([l]) => l).join(", ")}>
                    {m.languages.map(([l]) => (
                      <span key={l} className="size-2.5 rounded-full ring-2 ring-tile" style={{ background: langColor(l) }} />
                    ))}
                  </div>
                </Tile>
              </a>
            ))}
          </div>
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
