import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { handle, paginationParams, readJson, requireString } from "@/lib/http"

export async function GET(req: NextRequest) {
  return handle(req, async (ctx) => {
    const url = new URL(req.url)
    const { limit, offset } = paginationParams(req)
    return getBackend().companies.list(ctx, {
      search: url.searchParams.get("search") ?? undefined,
      limit,
      offset,
    })
  })
}

export async function POST(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<Record<string, unknown>>(req)
    const name = requireString(body.name, "Company name", { min: 2, max: 120 })
    return getBackend().companies.create(ctx, {
      name,
      domain: typeof body.domain === "string" ? body.domain : undefined,
      industry: typeof body.industry === "string" ? body.industry : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      city: typeof body.city === "string" ? body.city : undefined,
      state: typeof body.state === "string" ? body.state : undefined,
      country: typeof body.country === "string" ? body.country : undefined,
      ownerId: typeof body.ownerId === "string" && body.ownerId ? body.ownerId : null,
    })
  })
}
