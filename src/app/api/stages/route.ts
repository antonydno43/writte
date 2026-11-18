import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, readJson } from "@/lib/http"

export async function GET(req: NextRequest) {
  return handle(req, async (ctx) => {
    return { stages: await getBackend().stages.list(ctx) }
  })
}

interface StageInput {
  id?: string
  name?: string
  kind?: "open" | "won" | "lost"
}

export async function PUT(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<{ stages?: StageInput[] }>(req)
    const stages = body.stages
    if (!Array.isArray(stages) || stages.length === 0) {
      throw errors.badRequest("Send at least one pipeline stage")
    }
    const normalized = stages.map((s) => {
      const name = typeof s.name === "string" ? s.name.trim() : ""
      if (!name || name.length > 60) throw errors.badRequest("Every stage needs a name (max 60 characters)")
      if (s.kind !== "open" && s.kind !== "won" && s.kind !== "lost") {
        throw errors.badRequest("Stage kind must be open, won or lost")
      }
      return {
        id: typeof s.id === "string" && s.id.length > 0 ? s.id : undefined,
        name,
        kind: s.kind,
      }
    })
    return { stages: await getBackend().stages.replace(ctx, normalized) }
  })
}
