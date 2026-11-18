import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { handle } from "@/lib/http"

type Params = { params: Promise<{ token: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { token } = await params
    const info = await getBackend().invitations.info(ctx, token)
    return { invitation: info }
  })
}
