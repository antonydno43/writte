"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { api } from "@/lib/api-client"
import type { UserProfile, WorkspaceSummary } from "@/lib/types"

interface MeResponse {
  user: UserProfile | null
  workspaces: WorkspaceSummary[]
  activeWorkspace: WorkspaceSummary | null
  mode: "local" | "supabase"
}

interface AppState {
  status: "loading" | "authenticated" | "unauthenticated"
  user: UserProfile | null
  workspaces: WorkspaceSummary[]
  activeWorkspace: WorkspaceSummary | null
  mode: "local" | "supabase"
  refresh: () => Promise<void>
  switchWorkspace: (id: string) => Promise<void>
  logout: () => void
}

const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>")
  return ctx
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<{
    status: AppState["status"]
    user: UserProfile | null
    workspaces: WorkspaceSummary[]
    activeWorkspace: WorkspaceSummary | null
    mode: "local" | "supabase"
  }>({
    status: "loading",
    user: null,
    workspaces: [],
    activeWorkspace: null,
    mode: "local",
  })

  const load = useCallback((): Promise<void> => {
    const p = api<MeResponse>("/api/auth/me")
      .then((data) => {
        setState({
          status: data.user ? "authenticated" : "unauthenticated",
          user: data.user,
          workspaces: data.workspaces ?? [],
          activeWorkspace: data.activeWorkspace,
          mode: data.mode ?? "local",
        })
      })
      .catch(() => {
        setState({
          status: "unauthenticated",
          user: null,
          workspaces: [],
          activeWorkspace: null,
          mode: "local",
        })
      })
    return p
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // A 401 from any API call flips us to signed-out instantly.
  useEffect(() => {
    const onUnauthorized = () => {
      setState((s) => ({ ...s, status: "unauthenticated", user: null, activeWorkspace: null }))
    }
    window.addEventListener("yb:unauthorized", onUnauthorized)
    return () => window.removeEventListener("yb:unauthorized", onUnauthorized)
  }, [])

  const refresh = useCallback(() => load(), [load])

  const switchWorkspace = useCallback(
    async (id: string) => {
      await api("/api/workspaces/switch", { method: "POST", body: { workspaceId: id } })
      await load()
    },
    [load]
  )

  const logout = useCallback(() => {
    api("/api/auth/logout", { method: "POST" })
      .catch(() => undefined)
      .finally(() => {
        setState({
          status: "unauthenticated",
          user: null,
          workspaces: [],
          activeWorkspace: null,
          mode: "local",
        })
        router.replace("/login")
      })
  }, [router])

  // Client-side routing guard (middleware handles full page loads).
  useEffect(() => {
    if (state.status === "loading") return
    const onPublicPage =
      pathname === "/" || pathname === "/login" || pathname === "/signup" || pathname.startsWith("/invite")
    if (state.status === "unauthenticated" && !onPublicPage) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    if (
      state.status === "authenticated" &&
      state.user &&
      state.workspaces.length === 0 &&
      pathname !== "/onboarding" &&
      !onPublicPage
    ) {
      router.replace("/onboarding")
    }
  }, [state.status, state.user, state.workspaces.length, pathname, router])

  return <AppContext.Provider value={{ ...state, refresh, switchWorkspace, logout }}>{children}</AppContext.Provider>
}
