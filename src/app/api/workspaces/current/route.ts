import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, readJson, requireString } from "@/lib/http"
import { isValidCurrency, isValidTimezone } from "@/lib/i18n"

export async function PATCH(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<Record<string, unknown>>(req)
    const input: { name?: string; baseCurrency?: string; timezone?: string } = {}
    if (body.name !== undefined) input.name = requireString(body.name, "Workspace name", { min: 2, max: 80 })
    if (body.baseCurrency !== undefined) {
      const cur = requireString(body.baseCurrency, "Currency", { max: 8 })
      if (!isValidCurrency(cur)) throw errors.badRequest("Unknown currency")
      input.baseCurrency = cur
    }
    if (body.timezone !== undefined) {
      const tz = requireString(body.timezone, "Timezone", { max: 60 })
      if (!isValidTimezone(tz)) throw errors.badRequest("Unknown timezone")
      input.timezone = tz
    }
    return getBackend().workspaces.update(ctx, input)
  })
}
