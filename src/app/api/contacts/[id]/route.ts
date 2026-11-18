import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, readJson } from "@/lib/http"
import { CONTACT_STATUSES, type ContactStatus } from "@/lib/types"

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { id } = await params
    return getBackend().contacts.get(ctx, id)
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { id } = await params
    const body = await readJson<Record<string, unknown>>(req)
    if (body.status !== undefined && !CONTACT_STATUSES.includes(body.status as ContactStatus)) {
      throw errors.badRequest("Invalid status")
    }
    return getBackend().contacts.update(ctx, id, {
      firstName: typeof body.firstName === "string" ? body.firstName : undefined,
      lastName: typeof body.lastName === "string" ? body.lastName : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      jobTitle: typeof body.jobTitle === "string" ? body.jobTitle : undefined,
      status: body.status as ContactStatus | undefined,
      companyId: typeof body.companyId === "string" ? body.companyId : undefined,
      ownerId: typeof body.ownerId === "string" ? body.ownerId : undefined,
      city: typeof body.city === "string" ? body.city : undefined,
      state: typeof body.state === "string" ? body.state : undefined,
      country: typeof body.country === "string" ? body.country : undefined,
    })
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { id } = await params
    await getBackend().contacts.delete(ctx, id)
    return { ok: true }
  })
}
