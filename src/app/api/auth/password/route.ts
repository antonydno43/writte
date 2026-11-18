import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { handle, readJson, requireString } from "@/lib/http"

export async function POST(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<Record<string, unknown>>(req)
    const currentPassword = requireString(body.currentPassword, "Current password", { max: 100 })
    const newPassword = requireString(body.newPassword, "New password", { min: 8, max: 100 })
    await getBackend().auth.changePassword(ctx, currentPassword, newPassword)
    return { ok: true }
  })
}
