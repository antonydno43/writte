/**
 * Internationalisation helpers for YourBiz CRM:
 * currencies (25+), timezones (all IANA zones), locale-aware money/date
 * formatting with Indian grouping, and indicative FX conversion.
 */

export interface CurrencyDef {
  code: string
  name: string
  symbol: string
  locale: string
}

/** Currencies relevant to India + global trade. locale controls grouping (e.g. 12,50,000). */
export const CURRENCIES: CurrencyDef[] = [
  { code: "INR", name: "Indian Rupee", symbol: "₹", locale: "en-IN" },
  { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US" },
  { code: "EUR", name: "Euro", symbol: "€", locale: "de-DE" },
  { code: "GBP", name: "British Pound", symbol: "£", locale: "en-GB" },
  { code: "AED", name: "UAE Dirham", symbol: "AED", locale: "en-AE" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR", locale: "ar-SA" },
  { code: "QAR", name: "Qatari Riyal", symbol: "QAR", locale: "en-QA" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KD", locale: "en-KW" },
  { code: "OMR", name: "Omani Rial", symbol: "OMR", locale: "en-OM" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", locale: "en-SG" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", locale: "en-AU" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", locale: "en-NZ" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", locale: "en-CA" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", locale: "ja-JP" },
  { code: "CNY", name: "Chinese Yuan", symbol: "CN¥", locale: "zh-CN" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", locale: "de-CH" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", locale: "en-HK" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", locale: "en-MY" },
  { code: "THB", name: "Thai Baht", symbol: "฿", locale: "th-TH" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", locale: "id-ID" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", locale: "vi-VN" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", locale: "en-PH" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", locale: "ko-KR" },
  { code: "ZAR", name: "South African Rand", symbol: "R", locale: "en-ZA" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", locale: "en-NG" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", locale: "en-KE" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", locale: "pt-BR" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", locale: "es-MX" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", locale: "tr-TR" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", locale: "ru-RU" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "Tk", locale: "en-BD" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs", locale: "en-LK" },
  { code: "NPR", name: "Nepalese Rupee", symbol: "Rs", locale: "en-NP" },
]

const CURRENCY_MAP = new Map(CURRENCIES.map((c) => [c.code, c]))

export function getCurrency(code: string): CurrencyDef {
  return CURRENCY_MAP.get(code) ?? { code, name: code, symbol: "", locale: "en-US" }
}

export function isValidCurrency(code: string): boolean {
  return CURRENCY_MAP.has(code)
}

/**
 * Indicative FX rates (relative to 1 USD). Used ONLY for approximate
 * workspace-level totals across mixed currencies; individual deals always
 * keep their native currency. Clearly labelled "approx" in the UI.
 * Update these when you like — they are display hints, not bookkeeping.
 */
export const INDICATIVE_USD_RATES: Record<string, number> = {
  USD: 1,
  INR: 84.5,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.31,
  OMR: 0.38,
  SGD: 1.34,
  AUD: 1.52,
  NZD: 1.64,
  CAD: 1.36,
  JPY: 150,
  CNY: 7.2,
  CHF: 0.88,
  HKD: 7.8,
  MYR: 4.5,
  THB: 34,
  IDR: 15700,
  VND: 25400,
  PHP: 57,
  KRW: 1360,
  ZAR: 18,
  NGN: 1550,
  KES: 129,
  BRL: 5.6,
  MXN: 17.5,
  TRY: 34,
  RUB: 95,
  BDT: 118,
  LKR: 300,
  NPR: 135,
}

/** Convert an amount between currencies using indicative rates. */
export function convertApprox(amount: number, from: string, to: string): number {
  const fromRate = INDICATIVE_USD_RATES[from]
  const toRate = INDICATIVE_USD_RATES[to]
  if (!fromRate || !toRate) return amount
  const usd = amount / fromRate
  return usd * toRate
}

/* ------------------------------- formatting ------------------------------- */

/** Round to 2 decimals (or 0 for JPY-style currencies). */
function sensibleDecimals(currency: string): number {
  return ["JPY", "KRW", "VND", "IDR", "NGN"].includes(currency) ? 0 : 2
}

export function formatMoney(
  amount: number,
  currency: string,
  opts: { compact?: boolean } = {}
): string {
  const def = getCurrency(currency)
  const decimals = sensibleDecimals(currency)
  const rounded =
    Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals)
  if (opts.compact && Math.abs(rounded) >= 1000) {
    try {
      const nf = new Intl.NumberFormat(def.locale, {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
        compactDisplay: "short",
      })
      return nf.format(rounded)
    } catch {
      /* fall through to full format */
    }
  }
  try {
    const nf = new Intl.NumberFormat(def.locale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    return nf.format(rounded)
  } catch {
    return `${def.symbol}${rounded.toLocaleString("en-IN")}`
  }
}

export function combineMoneyByCurrency(
  entries: { currency: string; amount: number }[]
): { currency: string; amount: number }[] {
  const map = new Map<string, number>()
  for (const e of entries) {
    map.set(e.currency, (map.get(e.currency) ?? 0) + e.amount)
  }
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => (a.currency === "INR" ? -1 : b.currency === "INR" ? 1 : a.currency.localeCompare(b.currency)))
}

/* -------------------------------- timezones ------------------------------- */

export const DEFAULT_TIMEZONE = "UTC"

export function listTimezones(): string[] {
  try {
    const zones = Intl.supportedValuesOf("timeZone")
    if (zones && zones.length > 0) return zones
  } catch {
    /* older engine fallback below */
  }
  return [
    "UTC",
    "Asia/Calcutta",
    "Asia/Dubai",
    "Asia/Singapore",
    "Asia/Hong_Kong",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Dhaka",
    "Asia/Karachi",
    "Asia/Kathmandu",
    "Asia/Colombo",
    "Australia/Sydney",
    "Australia/Melbourne",
    "Europe/London",
    "Europe/Dublin",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Moscow",
    "Africa/Nairobi",
    "Africa/Lagos",
    "Africa/Johannesburg",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Toronto",
    "America/Mexico_City",
    "America/Sao_Paulo",
  ]
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/* ---------------------------------- dates --------------------------------- */

type DateStyle = "date" | "datetime" | "time" | "relative"

/**
 * Format an ISO timestamp in a specific timezone.
 * ALWAYS call this from client components (render after mount) so SSR/CSR match.
 */
export function formatInZone(
  iso: string,
  timezone: string,
  style: DateStyle = "datetime"
): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  try {
    switch (style) {
      case "date":
        return new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(date)
      case "datetime":
        return new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }).format(date)
      case "time":
        return new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }).format(date)
      case "relative":
        return relativeTime(date)
    }
  } catch {
    return date.toISOString()
  }
}

export function relativeTime(date: Date): string {
  const diffMs = date.getTime() - Date.now()
  const absSeconds = Math.abs(diffMs) / 1000
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  if (absSeconds < 60) return rtf.format(Math.round(diffMs / 1000), "second")
  if (absSeconds < 3600) return rtf.format(Math.round(diffMs / 60000), "minute")
  if (absSeconds < 86400) return rtf.format(Math.round(diffMs / 3600000), "hour")
  if (absSeconds < 2592000) return rtf.format(Math.round(diffMs / 86400000), "day")
  return rtf.format(Math.round(diffMs / 2592000000), "month")
}

/** Convert "YYYY-MM-DD" (a plain date, timezone-free) into an ISO timestamp at 09:00 UTC. */
export function dateInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return `${value}T09:00:00.000Z`
}

export function isoToDateInput(iso: string | null): string | null {
  if (!iso) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  return m ? m[1] : null
}
