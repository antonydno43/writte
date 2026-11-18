import { NextRequest } from "next/server"

import { getBackend } from "@/lib/backend"
import { handle } from "@/lib/http"

type Params = { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  return handle(req, async (ctx) => {
    const { token } = await params
    const workspace = await getBackend().invitations.accept(ctx, token)
    return { workspace }
  })
}
