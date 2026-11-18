import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, isEmail, readJson, requireString } from "@/lib/http"

export async function POST(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<Record<string, unknown>>(req)
    const email = requireString(body.email, "Email", { max: 120 }).toLowerCase()
    const password = requireString(body.password, "Password", { max: 100 })
    if (!isEmail(email)) throw errors.badRequest("Please enter a valid email address")
    const user = await getBackend().auth.login(ctx, email, password)
    // Ensure an active workspace cookie exists right after login.
    const backend = getBackend()
    const active = await backend.workspaces.getActive(ctx)
    if (!active) {
      const list = await backend.workspaces.list(ctx)
      if (list.length > 0) await backend.workspaces.switch(ctx, list[0].id)
    }
    return { user }
  })
}
