import { NextRequest } from "next/server"

import { isSupabaseConfigured } from "@/lib/backend"
import { getBackend } from "@/lib/backend"
import { handle } from "@/lib/http"

export async function GET(req: NextRequest) {
  return handle(req, async (ctx) => {
    const backend = getBackend()
    const user = await backend.auth.currentUser(ctx)
    if (!user) return { user: null, workspaces: [], activeWorkspace: null, mode: backend.mode }

    const workspaces = await backend.workspaces.list(ctx)
    let activeWorkspace = await backend.workspaces.getActive(ctx)
    if (!activeWorkspace && workspaces.length > 0) {
      // repair: pick the first workspace if the cookie was stale/missing
      activeWorkspace = await backend.workspaces.switch(ctx, workspaces[0].id)
    }
    return { user, workspaces, activeWorkspace, mode: isSupabaseConfigured() ? "supabase" : "local" }
  })
}
