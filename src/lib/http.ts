import { NextRequest, NextResponse } from "next/server"

/** Typed error the API layer throws; `handle()` converts it to a JSON response. */
export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const errors = {
  badRequest: (msg = "Invalid request") => new ApiError(400, "bad_request", msg),
  unauthorized: (msg = "Please sign in to continue") => new ApiError(401, "unauthorized", msg),
  forbidden: (msg = "You do not have permission to do that") => new ApiError(403, "forbidden", msg),
  notFound: (msg = "Not found") => new ApiError(404, "not_found", msg),
  conflict: (msg = "That conflicts with existing data") => new ApiError(409, "conflict", msg),
  internal: (msg = "Something went wrong on our side") => new ApiError(500, "internal", msg),
}

/* ------------------------------ cookie adapter ----------------------------- */

interface CookieOp {
  name: string
  value: string
  options: Record<string, unknown>
}

const BASE_COOKIE = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
}

/**
 * Per-request context handed to backends: read-only access to incoming
 * cookies, buffered cookie writes (applied to the outgoing response),
 * and the public app URL (for email links).
 */
export class RequestContext {
  req: NextRequest
  appUrl: string
  private ops: CookieOp[] = []

  constructor(req: NextRequest) {
    this.req = req
    this.appUrl = resolveAppUrl(req)
  }

  cookies = {
    get: (name: string): string | undefined => this.req.cookies.get(name)?.value,
    set: (
      name: string,
      value: string,
      options: { maxAge?: number; httpOnly?: boolean } = {}
    ) => {
      this.ops.push({
        name,
        value,
        options: {
          ...BASE_COOKIE,
          httpOnly: options.httpOnly ?? true,
          ...(options.maxAge !== undefined ? { maxAge: options.maxAge } : {}),
        },
      })
    },
    delete: (name: string) => {
      this.ops.push({ name, value: "", options: { ...BASE_COOKIE, maxAge: 0 } })
    },
    /** For adapters like @supabase/ssr setAll */
    setRaw: (name: string, value: string, options: Record<string, unknown> = {}) => {
      this.ops.push({ name, value, options: { path: "/", ...options } })
    },
  }

  applyCookies(res: NextResponse): NextResponse {
    for (const op of this.ops) {
      if (op.value === "" && (op.options as { maxAge?: number }).maxAge === 0) {
        res.cookies.set(op.name, "", { ...(op.options as object), maxAge: 0 })
      } else {
        res.cookies.set(op.name, op.value, op.options as object)
      }
    }
    return res
  }
}

function resolveAppUrl(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl && envUrl.startsWith("http")) return envUrl.replace(/\/$/, "")
  const proto = req.headers.get("x-forwarded-proto") ?? "http"
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  if (host) return `${proto}://${host}`
  return new URL(req.url).origin
}

/* ------------------------------ route wrapper ------------------------------ */

/**
 * Wrap an API route handler body: builds the request context, converts thrown
 * ApiErrors into JSON responses, applies pending cookie writes.
 */
export async function handle<T>(
  req: NextRequest,
  fn: (ctx: RequestContext) => Promise<T>
): Promise<NextResponse> {
  const ctx = new RequestContext(req)
  try {
    const data = await fn(ctx)
    return ctx.applyCookies(NextResponse.json(data === undefined ? { ok: true } : data))
  } catch (err) {
    if (err instanceof ApiError) {
      return ctx.applyCookies(
        NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
      )
    }
    console.error("[api] Unhandled error:", err)
    return ctx.applyCookies(
      NextResponse.json(
        { error: "Something went wrong on our side", code: "internal" },
        { status: 500 }
      )
    )
  }
}

/** Safely parse a JSON body (returns {} on malformed/empty). */
export async function readJson<T extends Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    const body = await req.json()
    if (body && typeof body === "object") return body as T
    return {} as T
  } catch {
    return {} as T
  }
}

/* -------------------------------- validation ------------------------------- */

export function requireString(
  value: unknown,
  field: string,
  opts: { min?: number; max?: number; optional?: boolean } = {}
): string {
  if (value === undefined || value === null || value === "") {
    if (opts.optional) return ""
    throw errors.badRequest(`${field} is required`)
  }
  if (typeof value !== "string") throw errors.badRequest(`${field} must be text`)
  const v = value.trim()
  if (opts.min !== undefined && v.length < opts.min)
    throw errors.badRequest(`${field} must be at least ${opts.min} characters`)
  if (opts.max !== undefined && v.length > opts.max)
    throw errors.badRequest(`${field} must be at most ${opts.max} characters`)
  if (!opts.optional && v.length === 0) throw errors.badRequest(`${field} is required`)
  return v
}

export function optionalString(value: unknown, field: string, max = 500):string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") throw errors.badRequest(`${field} must be text`)
  const v = value.trim()
  if (v.length === 0) return null
  if (v.length > max) throw errors.badRequest(`${field} must be at most ${max} characters`)
  return v
}

export function optionalNumber(value: unknown, field: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) throw errors.badRequest(`${field} must be a number`)
  if (n < min || n > max) throw errors.badRequest(`${field} must be between ${min} and ${max}`)
  return n
}

export function optionalId(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string" || value.length > 64) throw errors.badRequest(`${field} is invalid`)
  return value
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

export function paginationParams(req: NextRequest): { limit: number; offset: number } {
  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50) || 50, 1), 200)
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0)
  return { limit, offset }
}
