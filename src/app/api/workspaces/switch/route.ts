import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { handle, readJson } from "@/lib/http"

export async function POST(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<{ workspaceId?: string }>(req)
    if (!body.workspaceId) throw new Error("workspaceId is required")
    const ws = await getBackend().workspaces.switch(ctx, body.workspaceId)
    return { workspace: ws }
  })
}
