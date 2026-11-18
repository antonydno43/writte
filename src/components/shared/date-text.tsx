"use client"

import { useMemo, useSyncExternalStore } from "react"

import { formatInZone, relativeTime } from "@/lib/i18n"

const emptySubscribe = () => () => {}

/** Hydration-safe "is the client in charge now" flag. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

interface DateTextProps {
  iso: string | null | undefined
  style?: "date" | "datetime" | "time" | "relative"
  timezone?: string
  className?: string
}

/**
 * Renders a date/time in the given timezone (defaults to the browser's).
 * Renders after hydration so every user sees times in their own timezone
 * without server/client markup mismatches.
 */
export function DateText({ iso, style = "date", timezone, className }: DateTextProps) {
  const hydrated = useHydrated()
  const text = useMemo(() => {
    if (!iso) return null
    if (style === "relative") return relativeTime(new Date(iso))
    let tz = timezone ?? "UTC"
    if (!timezone) {
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      } catch {
        tz = "UTC"
      }
    }
    try {
      return formatInZone(iso, tz, style)
    } catch {
      return iso
    }
  }, [iso, style, timezone])

  if (!iso) return <span className={className}>—</span>
  if (!hydrated) return <span className={className}>&nbsp;</span>
  return <span className={className}>{text ?? "—"}</span>
}
