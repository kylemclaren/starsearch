import * as React from "react"
import { cn } from "../../lib/utils"

const variants = {
  outline: "bg-white/5 text-ink shadow-[inset_0_0_0_1px_var(--color-line-2)] hover:bg-white/10",
  ghost: "text-dim hover:bg-white/8 hover:text-ink",
}
const sizes = {
  sm: "h-7 rounded-full px-3 text-[12.5px] font-medium",
  "icon-sm": "size-7 rounded-full",
}

export function Button({
  className,
  variant = "outline",
  size = "sm",
  ...props
}: React.ComponentProps<"button"> & { variant?: keyof typeof variants; size?: keyof typeof sizes }) {
  return (
    <button
      data-slot="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 transition outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&_svg:not([class*='size-'])]:size-4",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
