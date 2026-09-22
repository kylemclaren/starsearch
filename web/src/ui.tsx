import type { ReactNode } from "react"

export const REPO_URL = "https://github.com/kylemclaren/starsearch"

export function GitHubLink() {
  return (
    <a href={REPO_URL} target="_blank" rel="noreferrer" className="pill shrink-0 hover:text-ink" aria-label="starsearch on GitHub">
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      <span className="hidden sm:inline">GitHub</span>
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
