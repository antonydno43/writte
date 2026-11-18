import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { handle } from "@/lib/http"

export async function POST(req: NextRequest) {
  return handle(req, async (ctx) => {
    await getBackend().auth.logout(ctx)
    return { ok: true }
  })
}
