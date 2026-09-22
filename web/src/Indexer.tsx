import { useEffect, useRef, useState } from "react"
import { uploadStars, type IndexMeta } from "./api"
import { fetchStars, GitHubError, type FetchProgress } from "./github"
import { TaskRows, type TaskRow, type TaskStatus } from "./TaskRows"
import { Tile } from "./ui"

type Step = "fetch" | "verify" | "embed"
const ORDER: Step[] = ["fetch", "verify", "embed"]
type Timing = Partial<Record<Step, { start: number; end?: number }>>

function secs(t: { start: number; end?: number } | undefined, now: number) {
  return t ? `${(((t.end ?? now) - t.start) / 1000).toFixed(1)}s` : "—"
}

export function Indexer({ login, onReady, reindex }: { login: string; onReady: (m: IndexMeta) => void; reindex?: boolean }) {
  const [step, setStep] = useState<Step | "ready">("fetch")
  const [timing, setTiming] = useState<Timing>({})
  const [fetchP, setFetchP] = useState<FetchProgress>()
  const [embedP, setEmbedP] = useState<{ done: number; total: number }>()
  const [verified, setVerified] = useState<boolean>()
  const [error, setError] = useState<{ step: Step; message: string; resetAt?: Date }>()
  const [attempt, setAttempt] = useState(0)
  const [now, setNow] = useState(() => performance.now())
  const ready = useRef(onReady)
  ready.current = onReady

  // Keep the elapsed-time readouts moving while work is in flight.
  useEffect(() => {
    if (step === "ready" || error) return
    const t = setInterval(() => setNow(performance.now()), 200)
    return () => clearInterval(t)
  }, [step, error])

  useEffect(() => {
    const ac = new AbortController()
    let current: Step = "fetch"
    const begin = (s: Step) => {
      const t = performance.now()
      setTiming((prev) => ({ ...prev, ...(current !== s && prev[current] ? { [current]: { ...prev[current]!, end: t } } : {}), [s]: { start: t } }))
      current = s
      setStep(s)
    }
    setError(undefined)
    setFetchP(undefined)
    setEmbedP(undefined)
    setVerified(undefined)
    setTiming({})
    begin("fetch")
    ;(async () => {
      try {
        const stars = await fetchStars(login, setFetchP, ac.signal)
        if (stars.length === 0) throw new Error(`${login} hasn't starred any public repositories yet.`)
        begin("verify")
        for await (const e of uploadStars(login, stars, ac.signal)) {
          if (e.type === "verified") {
            setVerified(e.verified)
            begin("embed")
          } else if (e.type === "embed") setEmbedP(e)
          else if (e.type === "ready") {
            const t = performance.now()
            setTiming((prev) => ({ ...prev, embed: prev.embed && { ...prev.embed, end: t } }))
            setStep("ready")
            // Let the last check land before swapping in the search view.
            setTimeout(() => !ac.signal.aborted && ready.current(e.meta), 900)
            return
          } else if (e.type === "error") throw new Error(e.message)
        }
      } catch (err) {
        if (ac.signal.aborted) return
        const t = performance.now()
        setTiming((prev) => ({ ...prev, [current]: prev[current] && { ...prev[current]!, end: t } }))
        setError({ step: current, message: (err as Error).message, resetAt: err instanceof GitHubError ? err.resetAt : undefined })
      }
    })()
    return () => ac.abort()
  }, [login, attempt])

  const statusOf = (s: Step): TaskStatus => {
    if (error?.step === s) return "failed"
    if (step === "ready") return "done"
    const i = ORDER.indexOf(s)
    const cur = ORDER.indexOf(step)
    return i < cur ? "done" : i === cur && !error ? "running" : "pending"
  }

  const rows: TaskRow[] = [
    {
      key: "fetch",
      step: 1,
      label: "Fetch stars from GitHub",
      status: statusOf("fetch"),
      amount: fetchP ? `${fetchP.count.toLocaleString()} stars` : undefined,
      progress: fetchP ? fetchP.page / fetchP.pages : undefined,
      details: [
        { label: "Pages (100 stars each)", meta: fetchP ? `${fetchP.page}/${fetchP.pages}` : "—" },
        { label: "GitHub requests left this hour", meta: fetchP?.remaining !== undefined ? String(fetchP.remaining) : "—" },
        { label: "Took", meta: secs(timing.fetch, now) },
      ],
    },
    {
      key: "verify",
      step: 2,
      label: "Check them against GitHub",
      status: statusOf("verify"),
      amount: statusOf("verify") === "pending" ? undefined : "1 request",
      details: [
        { label: "Re-fetch newest stars on the server", meta: verified === undefined ? (statusOf("verify") === "running" ? "checking" : "—") : verified ? "match" : "rate-limited" },
        { label: "Took", meta: secs(timing.verify, now) },
      ],
    },
    {
      key: "embed",
      step: 3,
      label: "Embed every repo",
      status: statusOf("embed"),
      amount: embedP ? `${embedP.done.toLocaleString()} / ${embedP.total.toLocaleString()}` : undefined,
      progress: embedP ? embedP.done / embedP.total : statusOf("embed") === "running" ? 0 : undefined,
      details: [
        { label: "Model", meta: "bge-small-en-v1.5" },
        { label: "Progress", meta: embedP ? `${Math.round((embedP.done / embedP.total) * 100)}%` : "—" },
        { label: "Took", meta: secs(timing.embed, now) },
      ],
    },
  ]

  return (
    <div className="mx-auto w-full max-w-[480px] fade-in">
      <Tile inner="p-5 sm:p-6">
        <div className="mb-5 px-1">
          <div className="text-[15px] font-medium">
            {reindex ? "Re-indexing" : "Indexing"} {login}’s stars
          </div>
          <p className="mt-1 text-[13px] text-mute">Happens once. After this, searches are instant for everyone.</p>
        </div>
        <TaskRows rows={rows} onRetry={() => setAttempt((a) => a + 1)} />
        {error && (
          <p className="mt-4 px-1 text-[13px] leading-relaxed text-bad/90" style={{ animation: "fade-in 200ms ease-out both" }}>
            {error.message}
            {error.resetAt && <> It resets at {error.resetAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.</>}
          </p>
        )}
      </Tile>
    </div>
  )
}
