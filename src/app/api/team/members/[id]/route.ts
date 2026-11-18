import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, readJson } from "@/lib/http"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { id } = await params
    const body = await readJson<{ role?: string }>(req)
    if (body.role !== "admin" && body.role !== "member") {
      throw errors.badRequest("Role must be admin or member")
    }
    await getBackend().team.setMemberRole(ctx, id, body.role)
    return { ok: true }
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { id } = await params
    await getBackend().team.removeMember(ctx, id)
    return { ok: true }
  })
}
