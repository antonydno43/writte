import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, readJson } from "@/lib/http"
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/types"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { id } = await params
    const body = await readJson<Record<string, unknown>>(req)
    const priority = body.priority as TaskPriority | undefined
    if (priority !== undefined && !TASK_PRIORITIES.includes(priority)) {
      throw errors.badRequest("Invalid priority")
    }
    return getBackend().tasks.update(ctx, id, {
      title: typeof body.title === "string" ? body.title : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      priority,
      status: body.status === "open" || body.status === "done" ? body.status : undefined,
      dueAt:
        typeof body.dueAt === "string"
          ? Number.isNaN(new Date(body.dueAt).getTime())
            ? undefined
            : body.dueAt
          : body.dueAt === null
            ? null
            : undefined,
      assigneeId: typeof body.assigneeId === "string" ? body.assigneeId : undefined,
      contactId: typeof body.contactId === "string" ? body.contactId : undefined,
      dealId: typeof body.dealId === "string" ? body.dealId : undefined,
    })
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { id } = await params
    await getBackend().tasks.delete(ctx, id)
    return { ok: true }
  })
}
