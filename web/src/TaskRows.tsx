/**
 * Task rows: capsules that carry a numbered ring while pending or running,
 * pop a check or cross when they settle, and drop down their detail lines.
 * Adapted from a static demo so real progress drives it instead of a timeline.
 */
import { useState, type ReactNode } from "react"

export type TaskStatus = "pending" | "running" | "done" | "failed"
export type TaskDetail = { label: string; meta: string }
export type TaskRow = {
  key: string
  label: string
  amount?: string
  status: TaskStatus
  step: number
  /** 0–1 fills the ring instead of spinning it. */
  progress?: number
  details: TaskDetail[]
}

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)"

function SpinnerRing({ active, progress, children }: { active?: boolean; progress?: number; children?: ReactNode }) {
  const size = 24
  const stroke = 2
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const determinate = active && progress !== undefined
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="absolute inset-0 -rotate-90"
        style={active && !determinate ? { animation: "spin 1.1s linear infinite" } : undefined}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line-2)" strokeWidth={stroke} />
        {active && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={determinate ? "var(--color-accent)" : "var(--color-dim)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={determinate ? `${c * Math.max(0.03, progress!)} ${c}` : `${c * 0.28} ${c * 0.72}`}
            style={{ transition: `stroke-dasharray 400ms ${EASE}` }}
          />
        )}
      </svg>
      <span className={`relative text-[10.5px] font-semibold tabular-nums ${active ? "text-ink" : "text-mute"}`}>{children}</span>
    </span>
  )
}

function Badge({ tone, children }: { tone: "red" | "green"; children: ReactNode }) {
  return (
    <span
      className={`flex size-[22px] shrink-0 items-center justify-center rounded-full text-white ${tone === "red" ? "bg-bad" : "bg-good"}`}
      style={{ animation: `pop-in 300ms ${EASE} both` }}
    >
      {children}
    </span>
  )
}

const XIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)
const CheckIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)
const RetryIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
  </svg>
)

export function TaskRows({ rows, onRetry }: { rows: TaskRow[]; onRetry?: () => void }) {
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({})

  const badgeFor = (row: TaskRow) => {
    if (row.status === "done") return <Badge tone="green">{CheckIcon}</Badge>
    if (row.status === "failed") return <Badge tone="red">{XIcon}</Badge>
    return (
      <SpinnerRing active={row.status === "running"} progress={row.progress}>
        {row.step}
      </SpinnerRing>
    )
  }

  const pillFor = (row: TaskRow) => {
    if (row.status === "done")
      return (
        <span className="inline-flex h-[22px] items-center rounded-full bg-good-tint px-2 text-[11.5px] font-medium text-good" style={{ animation: "fade-in 200ms ease-out both" }}>
          Completed
        </span>
      )
    if (row.status === "failed")
      return (
        <span
          role={onRetry ? "button" : undefined}
          tabIndex={onRetry ? 0 : undefined}
          title={onRetry ? "Try again" : undefined}
          onClick={(e) => {
            e.stopPropagation()
            onRetry?.()
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              e.stopPropagation()
              onRetry?.()
            }
          }}
          className="inline-flex h-[22px] cursor-pointer items-center gap-1.5 rounded-full bg-bad-tint px-2 text-[11.5px] font-medium text-bad transition hover:brightness-125"
          style={{ animation: "fade-in 200ms ease-out both" }}
        >
          Failed <span className="flex">{RetryIcon}</span>
        </span>
      )
    return null
  }

  return (
    <div className="task-rows flex w-full flex-col gap-2">
      {rows.map((row, i) => {
        // The row that is working shows its details until the user says otherwise.
        const open = manualOpen[row.key] ?? (row.status === "running" || row.status === "failed")
        return (
          <div
            key={row.key}
            className="self-stretch overflow-hidden bg-tile-2 shadow-[inset_0_0_0_1px_var(--color-line)] transition-[border-radius,background-color] duration-300 hover:bg-[#202020]"
            style={{ borderRadius: open ? 14 : 22, animation: `fade-up 450ms ${EASE} ${i * 80}ms both` }}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setManualOpen((cur) => ({ ...cur, [row.key]: !open }))}
              className="flex h-11 w-full items-center gap-2.5 px-2.5 text-left"
            >
              <span className="flex size-6 shrink-0 items-center justify-center">{badgeFor(row)}</span>
              <span className={`min-w-0 flex-1 truncate text-[13px] font-medium ${row.status === "pending" ? "text-mute" : "text-ink"}`}>{row.label}</span>
              {row.amount && <span className="shrink-0 text-[12.5px] text-dim tabular-nums">{row.amount}</span>}
              {pillFor(row)}
              <span aria-hidden className="-ml-1 flex size-7 shrink-0 items-center justify-center rounded-full text-mute">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform duration-300"
                  style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>

            <div
              className="grid transition-[grid-template-rows,opacity] duration-300"
              style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, transitionTimingFunction: EASE }}
            >
              <div className="overflow-hidden">
                <div className="mb-2.5 grid grid-cols-[24px_1fr] gap-2.5 px-2.5">
                  <span aria-hidden className="mx-auto h-full w-px bg-line-2" />
                  <div className="flex flex-col gap-1.5">
                    {row.details.map((d, j) => (
                      <div
                        key={d.label}
                        className="flex items-center justify-between gap-4"
                        style={open ? { animation: `fade-up 300ms ${EASE} ${120 + j * 100}ms both` } : undefined}
                      >
                        <span className="text-[12px] text-dim">{d.label}</span>
                        <span className="text-right font-mono text-[11.5px] text-mute tabular-nums">{d.meta}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
