import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, isEmail, readJson, requireString } from "@/lib/http"
import { isValidCurrency, isValidTimezone } from "@/lib/i18n"

export async function POST(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<Record<string, unknown>>(req)
    const name = requireString(body.name, "Name", { min: 2, max: 80 })
    const emailRaw = requireString(body.email, "Email", { max: 120 }).toLowerCase()
    if (!isEmail(emailRaw)) throw errors.badRequest("Please enter a valid email address")
    const password = requireString(body.password, "Password", { min: 8, max: 100 })
    const timezone = typeof body.timezone === "string" && isValidTimezone(body.timezone) ? body.timezone : "UTC"
    const currency = typeof body.currency === "string" && isValidCurrency(body.currency) ? body.currency : "INR"
    return getBackend().auth.signup(ctx, { name, email: emailRaw, password, timezone, currency })
  })
}
