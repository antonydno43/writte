import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, paginationParams, readJson, requireString } from "@/lib/http"
import { isValidCurrency } from "@/lib/i18n"

export async function GET(req: NextRequest) {
  return handle(req, async (ctx) => {
    const url = new URL(req.url)
    const { limit, offset } = paginationParams(req)
    return getBackend().deals.list(ctx, {
      search: url.searchParams.get("search") ?? undefined,
      contactId: url.searchParams.get("contactId") ?? undefined,
      limit,
      offset,
    })
  })
}

export async function POST(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<Record<string, unknown>>(req)
    const title = requireString(body.title, "Deal title", { min: 2, max: 120 })
    const amount = typeof body.amount === "number" ? Math.max(0, Math.round(body.amount * 100) / 100) : undefined
    const currency = typeof body.currency === "string" ? body.currency : undefined
    if (currency && !isValidCurrency(currency)) throw errors.badRequest("Unknown currency")
    const expectedCloseDate =
      typeof body.expectedCloseDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.expectedCloseDate)
        ? body.expectedCloseDate
        : null
    return getBackend().deals.create(ctx, {
      title,
      amount,
      currency,
      stageId: typeof body.stageId === "string" && body.stageId ? body.stageId : undefined,
      probability: typeof body.probability === "number" ? Math.round(body.probability) : undefined,
      expectedCloseDate,
      contactId: typeof body.contactId === "string" && body.contactId ? body.contactId : null,
      companyId: typeof body.companyId === "string" && body.companyId ? body.companyId : null,
      ownerId: typeof body.ownerId === "string" && body.ownerId ? body.ownerId : null,
    })
  })
}
