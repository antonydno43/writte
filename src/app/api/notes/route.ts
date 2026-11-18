import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, readJson, requireString } from "@/lib/http"

export async function GET(req: NextRequest) {
  return handle(req, async (ctx) => {
    const url = new URL(req.url)
    const entityType = url.searchParams.get("entityType")
    const entityId = url.searchParams.get("entityId")
    if ((entityType !== "contact" && entityType !== "deal") || !entityId) {
      throw errors.badRequest("entityType and entityId are required")
    }
    return { notes: await getBackend().notes.list(ctx, entityType, entityId) }
  })
}

export async function POST(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<Record<string, unknown>>(req)
    const entityType = body.entityType === "deal" ? "deal" : "contact"
    const entityId = requireString(body.entityId, "entityId", { max: 64 })
    const note = requireString(body.body, "Note", { min: 1, max: 2000 })
    return getBackend().notes.create(ctx, { entityType, entityId, body: note })
  })
}
