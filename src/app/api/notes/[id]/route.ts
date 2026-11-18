import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { handle } from "@/lib/http"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { id } = await params
    await getBackend().notes.delete(ctx, id)
    return { ok: true }
  })
}
