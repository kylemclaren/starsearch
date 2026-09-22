import { useEffect, useState } from "react"

export function navigate(to: string, replace = false) {
  if (to === location.pathname + location.search) return
  history[replace ? "replaceState" : "pushState"]({}, "", to)
  dispatchEvent(new PopStateEvent("popstate"))
}

export function useLocation() {
  const [loc, setLoc] = useState(() => ({ path: location.pathname, search: location.search }))
  useEffect(() => {
    const on = () => setLoc({ path: location.pathname, search: location.search })
    addEventListener("popstate", on)
    return () => removeEventListener("popstate", on)
  }, [])
  return loc
}
