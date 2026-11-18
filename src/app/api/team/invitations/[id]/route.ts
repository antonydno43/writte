import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, readJson } from "@/lib/http"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { id } = await params
    const body = await readJson<{ action?: string }>(req)
    if (body.action === "revoke") {
      await getBackend().team.revoke(ctx, id)
      return { ok: true }
    }
    if (body.action === "resend") {
      return getBackend().team.resend(ctx, id)
    }
    throw errors.badRequest("action must be resend or revoke")
  })
}
