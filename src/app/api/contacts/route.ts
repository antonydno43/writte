import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, paginationParams, readJson, requireString } from "@/lib/http"
import { CONTACT_STATUSES, type ContactStatus } from "@/lib/types"

export async function GET(req: NextRequest) {
  return handle(req, async (ctx) => {
    const url = new URL(req.url)
    const { limit, offset } = paginationParams(req)
    const status = url.searchParams.get("status") ?? undefined
    if (status && !CONTACT_STATUSES.includes(status as ContactStatus)) {
      throw errors.badRequest("Invalid status filter")
    }
    return getBackend().contacts.list(ctx, {
      search: url.searchParams.get("search") ?? undefined,
      status: status || undefined,
      ownerId: url.searchParams.get("ownerId") ?? undefined,
      companyId: url.searchParams.get("companyId") ?? undefined,
      limit,
      offset,
    })
  })
}

export async function POST(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<Record<string, unknown>>(req)
    const firstName = requireString(body.firstName, "First name", { min: 1, max: 60 })
    const status = body.status as ContactStatus
    if (status !== undefined && !CONTACT_STATUSES.includes(status)) {
      throw errors.badRequest("Invalid contact status")
    }
    return getBackend().contacts.create(ctx, {
      firstName,
      lastName: typeof body.lastName === "string" ? body.lastName : "",
      email: typeof body.email === "string" ? body.email : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      jobTitle: typeof body.jobTitle === "string" ? body.jobTitle : undefined,
      status: status && CONTACT_STATUSES.includes(status) ? status : "lead",
      companyId: typeof body.companyId === "string" && body.companyId ? body.companyId : null,
      ownerId: typeof body.ownerId === "string" && body.ownerId ? body.ownerId : null,
      city: typeof body.city === "string" ? body.city : undefined,
      state: typeof body.state === "string" ? body.state : undefined,
      country: typeof body.country === "string" ? body.country : undefined,
    })
  })
}
