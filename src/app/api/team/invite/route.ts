import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, isEmail, readJson, requireString } from "@/lib/http"

export async function POST(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<Record<string, unknown>>(req)
    const email = requireString(body.email, "Email", { max: 120 }).toLowerCase()
    if (!isEmail(email)) throw errors.badRequest("Please enter a valid email address")
    const role = body.role === "admin" ? "admin" : "member"
    return getBackend().team.invite(ctx, email, role)
  })
}
