"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { api, ApiClientError } from "@/lib/api-client"

interface Result<T> {
  path: string
  data: T | null
  error: string | null
}

/**
 * Tiny data hook for GET endpoints. Pass `null` as path to skip fetching.
 * `reload()` re-runs the request keeping the previous data visible (no
 * skeleton flash); `setData` lets pages apply optimistic updates.
 */
export function useApiData<T>(path: string | null, deps: unknown[] = []): {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
  setData: (updater: (prev: T | null) => T | null) => void
} {
  const [result, setResult] = useState<Result<T> | null>(null)
  const [tick, setTick] = useState(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (path === null) return
    api<T>(path)
      .then((data) => {
        if (alive.current) setResult({ path, data, error: null })
      })
      .catch((err: ApiClientError) => {
        if (alive.current) setResult({ path, data: null, error: err.message })
      })
  }, [path, tick, ...deps])

  const loading = path !== null && (result === null || result.path !== path)
  const data = result && result.path === path ? result.data : null
  const error = result && result.path === path ? result.error : null

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const setData = useCallback((updater: (prev: T | null) => T | null) => {
    setResult((r) => (r ? { ...r, data: updater(r.data) } : r))
  }, [])

  return { data, loading, error, reload, setData }
}
