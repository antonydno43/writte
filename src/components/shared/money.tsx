"use client"

import { useMemo } from "react"

import { formatMoney } from "@/lib/i18n"
import type { MoneyByCurrency } from "@/lib/types"

function moneyText(amount: number, currency: string, compact: boolean): string {
  try {
    return formatMoney(amount, currency, { compact })
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function Money({
  amount,
  currency,
  compact = false,
  className,
}: {
  amount: number
  currency: string
  compact?: boolean
  className?: string
}) {
  const text = useMemo(() => moneyText(amount, currency, compact), [amount, currency, compact])
  return <span className={className}>{text}</span>
}

/** Renders a sum split by currency, e.g. "₹12,50,000 + $4,500". */
export function MultiCurrencyTotal({
  entries,
  compact = true,
  className,
}: {
  entries: MoneyByCurrency[]
  compact?: boolean
  className?: string
}) {
  const parts = useMemo(
    () => entries.map((e) => moneyText(e.amount, e.currency, compact)),
    [entries, compact]
  )
  if (entries.length === 0) {
    return <span className={className}>—</span>
  }
  return (
    <span className={className}>
      {parts.map((part, i) => (
        <span key={entries[i].currency}>
          {i > 0 && <span className="text-muted-foreground"> + </span>}
          {part}
        </span>
      ))}
    </span>
  )
}
