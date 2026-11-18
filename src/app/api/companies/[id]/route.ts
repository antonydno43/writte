import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { handle, readJson } from "@/lib/http"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { id } = await params
    const body = await readJson<Record<string, unknown>>(req)
    return getBackend().companies.update(ctx, id, {
      name: typeof body.name === "string" ? body.name : undefined,
      domain: typeof body.domain === "string" ? body.domain : undefined,
      industry: typeof body.industry === "string" ? body.industry : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      city: typeof body.city === "string" ? body.city : undefined,
      state: typeof body.state === "string" ? body.state : undefined,
      country: typeof body.country === "string" ? body.country : undefined,
      ownerId: typeof body.ownerId === "string" ? body.ownerId : undefined,
    })
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { id } = await params
    await getBackend().companies.delete(ctx, id)
    return { ok: true }
  })
}
