import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { handle } from "@/lib/http"

export async function GET(req: NextRequest) {
  return handle(req, async (ctx) => {
    return getBackend().team.list(ctx)
  })
}
