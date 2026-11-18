"use client"

export class ApiClientError extends Error {
  status: number
  code: string
  constructor(message: string, status: number, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  body?: unknown
}

/**
 * Frontend fetch helper for the YourBiz API. Throws ApiClientError with a
 * human-friendly message on any failure; broadcasts "yb:unauthorized" on 401
 * so the app provider can route to /login.
 */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method ?? "GET"
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    })
  } catch {
    throw new ApiClientError("Could not reach the server. Check your connection and try again.", 0, "network")
  }

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("yb:unauthorized"))
  }

  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const err = payload as { error?: string; code?: string } | null
    throw new ApiClientError(
      err?.error ?? (res.status === 403 ? "You do not have permission to do that" : "Something went wrong"),
      res.status,
      err?.code ?? "error"
    )
  }
  return payload as T
}
