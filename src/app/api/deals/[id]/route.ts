import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, readJson } from "@/lib/http"
import { isValidCurrency } from "@/lib/i18n"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { id } = await params
    const body = await readJson<Record<string, unknown>>(req)
    const currency = typeof body.currency === "string" ? body.currency : undefined
    if (currency && !isValidCurrency(currency)) throw errors.badRequest("Unknown currency")
    return getBackend().deals.update(ctx, id, {
      title: typeof body.title === "string" ? body.title : undefined,
      amount: typeof body.amount === "number" ? Math.round(body.amount * 100) / 100 : undefined,
      currency,
      stageId: typeof body.stageId === "string" ? body.stageId : undefined,
      probability: typeof body.probability === "number" ? Math.round(body.probability) : undefined,
      expectedCloseDate:
        typeof body.expectedCloseDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.expectedCloseDate)
          ? body.expectedCloseDate
          : undefined,
      contactId: typeof body.contactId === "string" ? body.contactId : undefined,
      companyId: typeof body.companyId === "string" ? body.companyId : undefined,
      ownerId: typeof body.ownerId === "string" ? body.ownerId : undefined,
    })
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { id } = await params
    await getBackend().deals.delete(ctx, id)
    return { ok: true }
  })
}
