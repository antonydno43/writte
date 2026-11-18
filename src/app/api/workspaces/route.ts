import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { handle, readJson, requireString } from "@/lib/http"

export async function POST(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<Record<string, unknown>>(req)
    const name = requireString(body.name, "Workspace name", { min: 2, max: 80 })
    const baseCurrency = typeof body.baseCurrency === "string" ? body.baseCurrency : undefined
    const timezone = typeof body.timezone === "string" ? body.timezone : undefined
    return getBackend().workspaces.create(ctx, { name, baseCurrency, timezone })
  })
}
