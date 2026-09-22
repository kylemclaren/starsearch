import { useEffect, useRef, useState } from "react"
import { Arc } from "loading-dev"
import { uploadStars, type IndexMeta } from "./api"
import { fetchStars, GitHubError, type FetchProgress } from "./github"
import { Check, Tile } from "./ui"

type Step = "fetch" | "verify" | "embed"
const STEPS: { key: Step; label: string }[] = [
  { key: "fetch", label: "Fetch stars from GitHub" },
  { key: "verify", label: "Check them against GitHub" },
  { key: "embed", label: "Embed every repo" },
]

export function Indexer({ login, onReady, reindex }: { login: string; onReady: (m: IndexMeta) => void; reindex?: boolean }) {
  const [step, setStep] = useState<Step>("fetch")
  const [fetchP, setFetchP] = useState<FetchProgress>()
  const [embedP, setEmbedP] = useState<{ done: number; total: number }>()
  const [error, setError] = useState<{ message: string; resetAt?: Date }>()
  const [attempt, setAttempt] = useState(0)
  const ready = useRef(onReady)
  ready.current = onReady

  useEffect(() => {
    const ac = new AbortController()
    setError(undefined)
    setStep("fetch")
    setFetchP(undefined)
    setEmbedP(undefined)
    ;(async () => {
      try {
        const stars = await fetchStars(login, setFetchP, ac.signal)
        if (stars.length === 0) throw new Error(`${login} hasn't starred any public repositories yet.`)
        setStep("verify")
        for await (const e of uploadStars(login, stars, ac.signal)) {
          if (e.type === "embed") {
            setStep("embed")
            setEmbedP(e)
          } else if (e.type === "verified") setStep("embed")
          else if (e.type === "ready") return ready.current(e.meta)
          else if (e.type === "error") throw new Error(e.message)
        }
      } catch (err) {
        if (ac.signal.aborted) return
        setError({ message: (err as Error).message, resetAt: err instanceof GitHubError ? err.resetAt : undefined })
      }
    })()
    return () => ac.abort()
  }, [login, attempt])

  const order = STEPS.findIndex((s) => s.key === step)
  const detail: Record<Step, string | undefined> = {
    fetch: fetchP && `${fetchP.count.toLocaleString()} stars · page ${fetchP.page} of ${fetchP.pages}${fetchP.remaining !== undefined ? ` · ${fetchP.remaining} GitHub requests left this hour` : ""}`,
    verify: undefined,
    embed: embedP && `${embedP.done.toLocaleString()} of ${embedP.total.toLocaleString()}`,
  }
  const pct =
    step === "fetch" ? (fetchP ? fetchP.page / fetchP.pages : 0) * 0.35 : step === "verify" ? 0.38 : 0.4 + (embedP ? (embedP.done / embedP.total) * 0.6 : 0)

  return (
    <div className="mx-auto w-full max-w-[520px] fade-in">
      <Tile inner="p-6 sm:p-7">
        <div className="text-[15px] font-medium">{reindex ? "Re-indexing" : "Indexing"} {login}’s stars</div>
        <p className="mt-1 text-[13.5px] text-mute">Happens once. After this, searches are instant for everyone.</p>

        <ol className="mt-6 space-y-4">
          {STEPS.map((s, i) => {
            const state = error && i === order ? "error" : i < order ? "done" : i === order ? "active" : "todo"
            return (
              <li key={s.key} className="flex gap-3">
                <span
                  className={`mt-px grid size-6 shrink-0 place-items-center rounded-full ${
                    state === "done" ? "bg-good/15 text-good" : state === "error" ? "bg-red-500/15 text-red-400" : state === "active" ? "bg-accent-soft text-accent" : "bg-white/5 text-mute"
                  }`}
                >
                  {state === "done" ? <Check /> : state === "active" ? <Arc size={13} color="currentColor" /> : state === "error" ? "!" : <span className="size-1.5 rounded-full bg-current" />}
                </span>
                <div className="min-w-0">
                  <div className={`text-[14px] ${state === "todo" ? "text-mute" : "text-ink"}`}>{s.label}</div>
                  {state !== "todo" && detail[s.key] && <div className="mt-0.5 font-mono text-[12px] text-mute tabular-nums">{detail[s.key]}</div>}
                </div>
              </li>
            )
          })}
        </ol>

        <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/6">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>

        {error && (
          <div className="mt-5 rounded-[14px] bg-red-500/8 p-4 text-[13.5px] leading-relaxed text-red-200 ring-1 ring-red-500/20">
            {error.message}
            {error.resetAt && <> It resets at {error.resetAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.</>}
            <div className="mt-3">
              <button className="pill" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </button>
            </div>
          </div>
        )}
      </Tile>
    </div>
  )
}
