import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, readJson, requireString } from "@/lib/http"
import { isValidCurrency, isValidTimezone } from "@/lib/i18n"

export async function PATCH(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<Record<string, unknown>>(req)
    const input: { name?: string; timezone?: string; currency?: string } = {}
    if (body.name !== undefined) input.name = requireString(body.name, "Name", { min: 2, max: 80 })
    if (body.timezone !== undefined) {
      const tz = requireString(body.timezone, "Timezone", { max: 60 })
      if (!isValidTimezone(tz)) throw errors.badRequest("Unknown timezone")
      input.timezone = tz
    }
    if (body.currency !== undefined) {
      const cur = requireString(body.currency, "Currency", { max: 8 })
      if (!isValidCurrency(cur)) throw errors.badRequest("Unknown currency")
      input.currency = cur
    }
    return getBackend().auth.updateProfile(ctx, input)
  })
}
