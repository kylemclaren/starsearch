import { useState } from "react"
import { BorderBeam } from "border-beam"
import { navigate } from "./router"

const LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i

export function UsernameForm({ autoFocus }: { autoFocus?: boolean }) {
  const [value, setValue] = useState("")
  const [focused, setFocused] = useState(false)
  const login = value.trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//, "").replace(/\/.*$/, "")
  const valid = LOGIN_RE.test(login)
  return (
    <form
      role="search"
      autoComplete="off"
      data-1p-ignore
      className="w-full max-w-[520px]"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) navigate(`/${login.toLowerCase()}`)
      }}
    >
      <BorderBeam size="md" colorVariant="ocean" strength={focused ? 1 : 0.55} duration={focused ? 3 : 6}>
        <div className="flex h-14 items-center gap-2 rounded-[18px] bg-tile pl-5 pr-2 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
          <span className="font-mono text-[15px] text-mute select-none">github.com/</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus={autoFocus}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="username"
            type="search"
            name="gh-user-lookup"
            aria-label="GitHub username"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            className="min-w-0 flex-1 bg-transparent font-mono text-[15px] text-ink outline-none placeholder:text-mute/70"
          />
          <button
            type="submit"
            disabled={!valid}
            className="h-10 rounded-[12px] bg-accent px-4 text-sm font-medium text-white transition hover:brightness-110 disabled:bg-white/8 disabled:text-mute"
          >
            Open stars
          </button>
        </div>
      </BorderBeam>
    </form>
  )
}
