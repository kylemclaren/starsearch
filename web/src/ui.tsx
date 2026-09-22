import type { ReactNode } from "react"

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <a
      href="/"
      onClick={(e) => {
        if (!onClick) return
        e.preventDefault()
        onClick()
      }}
      className="inline-flex items-center gap-2.5 text-[15px] font-medium tracking-tight text-ink"
    >
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#1f1f1f" />
        <path d="M16 7.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L16 20.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="none" stroke="#ededed" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <span>
        Stargaze<span className="text-mute">.search</span>
      </span>
    </a>
  )
}

export function Tile({ children, className = "", inner = "" }: { children: ReactNode; className?: string; inner?: string }) {
  return (
    <div className={`tile ${className}`}>
      <div className={`tile-inner ${inner}`}>{children}</div>
    </div>
  )
}

export function Avatar({ owner, size = 32, className = "" }: { owner: string; size?: number; className?: string }) {
  return (
    <img
      src={`https://github.com/${owner}.png?size=${size * 2}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={`shrink-0 rounded-[9px] bg-tile-2 ring-1 ring-line ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

export function Check({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className={className} aria-hidden>
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" className={className} aria-hidden>
      <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="currentColor" />
    </svg>
  )
}

export function compact(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n)
}

export function ago(iso?: string) {
  if (!iso) return ""
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, "y"],
    [60 * 60 * 24 * 30, "mo"],
    [60 * 60 * 24 * 7, "w"],
    [60 * 60 * 24, "d"],
    [60 * 60, "h"],
    [60, "m"],
  ]
  for (const [secs, label] of units) if (s >= secs) return `${Math.floor(s / secs)}${label} ago`
  return "just now"
}

// Primary-language colours for the handful that dominate most star lists.
const LANG: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Go: "#00ADD8", Rust: "#dea584", Ruby: "#701516",
  Shell: "#89e051", HTML: "#e34c26", CSS: "#663399", "C++": "#f34b7d", C: "#555555", Swift: "#F05138", Java: "#b07219",
  Elixir: "#6e4a7e", Kotlin: "#A97BFF", PHP: "#4F5D95", "C#": "#178600", Zig: "#ec915c", Lua: "#000080", Vue: "#41b883",
  Svelte: "#ff3e00", Astro: "#ff5a03", Dart: "#00B4AB", Haskell: "#5e5086", Scala: "#c22d40", Nix: "#7e7eff",
  "Jupyter Notebook": "#DA5B0B", HCL: "#844FBA", Dockerfile: "#384d54", MDX: "#fcb32c", OCaml: "#ef7a08", Gleam: "#ffaff3",
}
export const langColor = (l?: string) => (l && LANG[l]) || "#8b8b8b"
