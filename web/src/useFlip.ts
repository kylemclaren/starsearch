import { useLayoutEffect, useRef } from "react"

/**
 * FLIP-animates children keyed by `data-flip` when their order changes, so
 * rows visibly climb and fall as Jev re-ranks the list.
 */
export function useFlip<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null)
  const last = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    const next = new Map<string, number>()
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
      const key = el.dataset.flip!
      const top = el.getBoundingClientRect().top
      next.set(key, top)
      const prev = last.current.get(key)
      if (reduce || prev === undefined || Math.abs(prev - top) < 1) return
      el.animate([{ transform: `translateY(${prev - top}px)` }, { transform: "translateY(0)" }], {
        duration: 520,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      })
    })
    last.current = next
  }, [dep])
  return ref
}
