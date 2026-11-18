import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { errors, handle, paginationParams, readJson, requireString } from "@/lib/http"
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/types"

export async function GET(req: NextRequest) {
  return handle(req, async (ctx) => {
    const url = new URL(req.url)
    const { limit, offset } = paginationParams(req)
    const status = url.searchParams.get("status") ?? undefined
    if (status && status !== "open" && status !== "done") {
      throw errors.badRequest("Invalid status filter")
    }
    return getBackend().tasks.list(ctx, {
      status: status || undefined,
      assigneeId: url.searchParams.get("assigneeId") ?? undefined,
      contactId: url.searchParams.get("contactId") ?? undefined,
      dealId: url.searchParams.get("dealId") ?? undefined,
      limit,
      offset,
    })
  })
}

export async function POST(req: NextRequest) {
  return handle(req, async (ctx) => {
    const body = await readJson<Record<string, unknown>>(req)
    const title = requireString(body.title, "Task title", { min: 2, max: 160 })
    const priority = body.priority as TaskPriority | undefined
    if (priority !== undefined && !TASK_PRIORITIES.includes(priority)) {
      throw errors.badRequest("Invalid priority")
    }
    const dueAt =
      typeof body.dueAt === "string" && !Number.isNaN(new Date(body.dueAt).getTime()) ? body.dueAt : null
    return getBackend().tasks.create(ctx, {
      title,
      description: typeof body.description === "string" ? body.description : undefined,
      priority: priority && TASK_PRIORITIES.includes(priority) ? priority : "normal",
      dueAt,
      assigneeId: typeof body.assigneeId === "string" && body.assigneeId ? body.assigneeId : null,
      contactId: typeof body.contactId === "string" && body.contactId ? body.contactId : null,
      dealId: typeof body.dealId === "string" && body.dealId ? body.dealId : null,
    })
  })
}
