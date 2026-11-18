"use client"

import { cn } from "@/lib/utils"

const PALETTE = [
  "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
  "bg-lime-100 text-lime-800 dark:bg-lime-900/60 dark:text-lime-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/60 dark:text-fuchsia-200",
]

function colorFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 997
  return PALETTE[hash % PALETTE.length]
}

function initials(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const second = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + second).toUpperCase() || "?"
}

export function OwnerAvatar({
  name,
  size = "md",
  className,
}: {
  name: string | null | undefined
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const sizeCls =
    size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-10 text-sm" : "size-8 text-xs"
  return (
    <span
      title={name ?? "Unassigned"}
      aria-label={name ?? "Unassigned"}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-full font-semibold tracking-wide",
        sizeCls,
        name ? colorFor(name) : "bg-muted text-muted-foreground",
        className
      )}
    >
      {initials(name)}
    </span>
  )
}
