import { useState } from "react"
import type { Hit } from "./api"
import { useFlip } from "./useFlip"
import { Avatar, StarIcon, ago, compact, langColor } from "./ui"

export function Results({ hits, demoted, judged }: { hits: Hit[]; demoted: Hit[]; judged: boolean }) {
  const [showDemoted, setShowDemoted] = useState(false)
  const ref = useFlip<HTMLOListElement>(hits.map((h) => h.id).join())
  return (
    <div>
      <ol ref={ref} className="divide-y divide-line">
        {hits.map((h, i) => (
          <Row key={h.id} hit={h} rank={i + 1} judged={judged} />
        ))}
      </ol>
      {demoted.length > 0 && (
        <div className="border-t border-line">
          <button onClick={() => setShowDemoted((v) => !v)} className="w-full px-5 py-3.5 text-left text-[13px] text-mute transition hover:text-dim">
            {showDemoted ? "Hide" : "Show"} {demoted.length} weaker {demoted.length === 1 ? "match" : "matches"} Jev set aside
          </button>
          {showDemoted && (
            <ol className="divide-y divide-line opacity-55">
              {demoted.map((h, i) => (
                <Row key={h.id} hit={h} rank={hits.length + i + 1} judged />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ hit: h, rank, judged }: { hit: Hit; rank: number; judged: boolean }) {
  const [owner, name] = h.id.split("/") as [string, string]
  const rel = h.relevance
  return (
    <li data-flip={h.id} className="fade-in">
      <a href={`https://github.com/${h.id}`} target="_blank" rel="noreferrer" className="group flex gap-4 px-5 py-4 transition hover:bg-white/[0.025]">
        <Avatar owner={owner} size={36} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-mono text-[14px]">
              <span className="text-mute">{owner}/</span>
              <span className="font-medium text-ink group-hover:underline group-hover:decoration-line-2 group-hover:underline-offset-4">{name}</span>
            </span>
            {h.archived && <span className="rounded-full px-1.5 text-[11px] text-mute ring-1 ring-line">archived</span>}
          </div>
          {h.description && <p className="mt-1 line-clamp-2 text-pretty text-[14px] leading-relaxed text-dim">{h.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12.5px] text-mute">
            {h.language && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: langColor(h.language) }} />
                {h.language}
              </span>
            )}
            <span className="inline-flex items-center gap-1 tabular-nums">
              <StarIcon /> {compact(h.stars)}
            </span>
            {h.starredAt && <span>starred {ago(h.starredAt)}</span>}
            {h.topics.slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[11.5px] ring-1 ring-line">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="hidden w-[76px] shrink-0 flex-col items-end gap-1.5 pt-1 sm:flex">
          <span className="font-mono text-[11px] text-mute tabular-nums">#{rank}</span>
          {judged && rel !== undefined ? (
            <>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/6" title={`Jev relevance ${rel.toFixed(2)}`}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(4, rel * 100)}%`, background: rel >= 0.5 ? "var(--color-good)" : rel >= 0.15 ? "var(--color-accent)" : "var(--color-mute)" }} />
              </div>
              <span className="font-mono text-[11px] text-dim tabular-nums">{Math.round(rel * 100)}%</span>
            </>
          ) : (
            <span className="font-mono text-[11px] text-mute">{h.via.length === 2 ? "kw+sem" : h.via[0] === "keyword" ? "keyword" : "semantic"}</span>
          )}
        </div>
      </a>
    </li>
  )
}
