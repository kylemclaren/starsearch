import { useEffect, useRef, useState } from "react"
import { BorderBeam } from "border-beam"
import { getMeta, search, type Hit, type IndexMeta } from "./api"
import { toast } from "./components/ui/toast"
import { Indexer } from "./Indexer"
import { Results } from "./Results"
import { navigate } from "./router"
import { Avatar, GitHubLink, Tile, ago } from "./ui"

const SUGGESTIONS = [
  "a terminal UI framework",
  "self-hosted alternative to Notion",
  "run LLMs locally",
  "make beautiful CLI output",
  "postgres but for vectors",
  "static site generator",
  "rate limiting middleware",
  "fonts for coding",
]

interface State {
  query: string
  hits: Hit[]
  demoted: Hit[]
  phase: "idle" | "retrieving" | "judging" | "done"
  hybridMs?: number
  jev?: { tookMs: number; judged: number; inputTokens: number; cached: boolean; answerable: number }
}

const EMPTY: State = { query: "", hits: [], demoted: [], phase: "idle" }

export function UserPage({ login }: { login: string }) {
  const [meta, setMeta] = useState<IndexMeta | null>()
  const [reindex, setReindex] = useState(false)
  const [loadError, setLoadError] = useState<string>()

  useEffect(() => {
    getMeta(login).then((m) => setMeta(m ?? null), (e) => setLoadError((e as Error).message))
  }, [login])

  useEffect(() => {
    document.title = `${login}’s stars · starsearch`
    return () => {
      document.title = "starsearch"
    }
  }, [login])

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-[1000px] items-center justify-between gap-4 px-4 sm:px-6">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault()
            navigate("/")
          }}
          className="text-[13px] text-mute transition hover:text-ink"
        >
          ← Search another user
        </a>
        <div className="flex min-w-0 items-center gap-4">
          {meta && !reindex && (
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar owner={login} size={26} className="rounded-full" />
              <a href={`https://github.com/${login}?tab=stars`} target="_blank" rel="noreferrer" className="truncate text-[14px] font-medium hover:underline">
                {login}
              </a>
            </div>
          )}
          <GitHubLink />
        </div>
      </header>

      <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        {loadError ? (
          <p className="text-center text-dim">{loadError}</p>
        ) : meta === undefined ? (
          <div className="py-24" />
        ) : meta === null || reindex ? (
          <Indexer
            login={login}
            reindex={reindex}
            onReady={(m) => {
              setMeta(m)
              setReindex(false)
            }}
          />
        ) : (
          <Search login={login} meta={meta} onReindex={() => setReindex(true)} />
        )}
      </main>
    </div>
  )
}

function Search({ login, meta, onReindex }: { login: string; meta: IndexMeta; onReindex: () => void }) {
  const params = new URLSearchParams(location.search)
  const [input, setInput] = useState(params.get("q") ?? "")
  const [lang, setLang] = useState<string | undefined>(params.get("lang") ?? undefined)
  const [state, setState] = useState<State>(EMPTY)
  const ac = useRef<AbortController>(undefined)
  const lastQuery = useRef("")
  const errorToast = useRef<string>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  async function run(q: string, language = lang) {
    q = q.trim()
    lastQuery.current = q
    ac.current?.abort()
    if (errorToast.current) toast.close(errorToast.current)
    const qs = new URLSearchParams()
    if (q) qs.set("q", q)
    if (language) qs.set("lang", language)
    history.replaceState({}, "", `/${login}${qs.size ? `?${qs}` : ""}`)
    if (!q) return setState(EMPTY)
    const ctl = (ac.current = new AbortController())
    setState((s) => ({ ...s, query: q, phase: "retrieving", jev: undefined }))
    const failed = (type: "warning" | "error", title: string, description: string) => {
      const id = (errorToast.current = toast.add({
        type,
        title,
        description,
        timeout: 8000,
        actionProps: {
          children: "Retry",
          onClick() {
            toast.close(id)
            run(q, language)
          },
        },
      }))
    }
    try {
      for await (const e of search(login, q, language, ctl.signal)) {
        if (ctl.signal.aborted) return
        if (e.type === "hybrid") setState({ query: q, hits: e.hits, demoted: [], phase: "judging", hybridMs: e.tookMs })
        else if (e.type === "jev")
          setState((s) => ({ ...s, hits: e.hits, demoted: e.demoted, phase: "done", jev: { tookMs: e.tookMs, judged: e.judged, inputTokens: e.inputTokens, cached: e.cached, answerable: e.answerable } }))
        else if (e.type === "error") {
          setState((s) => ({ ...s, phase: "done" }))
          failed("warning", "Jev couldn’t re-rank this search", `Showing keyword and semantic order instead. ${e.message}`)
        }
      }
    } catch (err) {
      if (ctl.signal.aborted) return
      setState((s) => ({ ...s, phase: "done" }))
      failed("error", "Search failed", (err as Error).message)
    }
  }

  // Natural-language queries read best when you finish the thought, so wait for a pause.
  useEffect(() => {
    const q = input.trim()
    if (q === lastQuery.current) return
    if (q.length > 0 && q.length < 3) return
    // Re-check when the timer fires: the on-load search may have run meanwhile.
    const t = setTimeout(() => q !== lastQuery.current && run(q), 550)
    return () => clearTimeout(t)
  }, [input])

  useEffect(() => {
    if (input.trim()) run(input)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    addEventListener("keydown", onKey)
    return () => {
      removeEventListener("keydown", onKey)
      ac.current?.abort()
    }
  }, [])

  const busy = state.phase === "retrieving" || state.phase === "judging"
  const langs = meta.languages.slice(0, 8)

  return (
    <div className="fade-in">
      <div className="mb-8 text-center">
        <h1 className="text-balance text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">
          {login}’s <span className="text-dim">{meta.count.toLocaleString()} stars</span>
        </h1>
        <p className="mt-2 text-[13px] text-mute">
          Indexed {ago(meta.indexedAt)}
          {!meta.verified && " · not yet checked against GitHub"} ·{" "}
          <button onClick={onReindex} className="text-dim underline decoration-line-2 underline-offset-4 hover:text-ink">
            Re-index
          </button>
        </p>
      </div>

      <form
        role="search"
        autoComplete="off"
        data-1p-ignore
        onSubmit={(e) => {
          e.preventDefault()
          run(input)
        }}
      >
        <BorderBeam size="md" colorVariant="ocean" active={busy} strength={0.9} duration={2.4}>
          <div className="flex h-[60px] items-center gap-3 rounded-[20px] bg-tile px-5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
            <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0 text-mute" aria-hidden>
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
              enterKeyHint="search"
              placeholder="Describe the repo you’re thinking of…"
              aria-label="Search stars"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore
              data-form-type="other"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-mute"
            />
            <span className="hidden shrink-0 items-center gap-2 text-[12px] text-mute sm:flex">
              {state.phase === "retrieving" ? (
<>retrieving…</>
              ) : state.phase === "judging" ? (
<>Jev is judging {state.hits.length}…</>
              ) : (
                <kbd className="rounded-md px-1.5 font-mono ring-1 ring-line">/</kbd>
              )}
            </span>
          </div>
        </BorderBeam>
      </form>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        <button
          className="pill"
          aria-pressed={!lang}
          onClick={() => {
            setLang(undefined)
            run(input, undefined)
          }}
        >
          All languages
        </button>
        {langs.map(([l, n]) => (
          <button
            key={l}
            className="pill"
            aria-pressed={lang === l}
            onClick={() => {
              const next = lang === l ? undefined : l
              setLang(next)
              run(input, next)
            }}
          >
            {l} <span className="tabular-nums opacity-60">{n}</span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {state.phase === "idle" ? (
          <div className="py-10 text-center">
            <p className="mb-4 text-[13px] text-mute">Try something like</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="pill"
                  onClick={() => {
                    setInput(s)
                    run(s)
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : state.hits.length === 0 && state.phase !== "done" ? (
          <div className="py-16" />
        ) : (
          <Tile inner="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3 text-[12px] text-mute">
              <span>
                {state.phase === "done" && state.jev ? (
                  state.jev.answerable < 0.3 ? (
                    <span className="text-amber-300/80">Jev doesn’t think any of these match well</span>
                  ) : (
                    <>
                      <span className="text-dim">{state.hits.length}</span> matches, re-ranked by Jev
                    </>
                  )
                ) : state.phase === "done" ? (
                  <>Keyword and semantic order · Jev unavailable</>
                ) : (
                  <>Hybrid candidates · waiting on Jev</>
                )}
              </span>
              <span className="font-mono tabular-nums [&>span]:whitespace-nowrap">
                <span>hybrid {state.hybridMs ?? "…"}ms</span>
                {state.jev && (
                  <>
                    {" · "}
                    <span>jev {state.jev.cached ? "cached" : `${state.jev.tookMs}ms`}</span>
                    {" · "}
                    <span>{state.jev.judged} judged</span>
                    {!state.jev.cached && state.jev.inputTokens > 0 && (
                      <>
                        {" · "}
                        <span>{(state.jev.inputTokens / 1000).toFixed(1)}k tokens</span>
                      </>
                    )}
                  </>
                )}
              </span>
            </div>
            {state.hits.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-mute">Nothing in {login}’s stars matches that.</p>
            ) : (
              <Results hits={state.hits} demoted={state.demoted} judged={state.phase === "done" && !!state.jev} />
            )}
          </Tile>
        )}
      </div>
    </div>
  )
}
