import { NextRequest, NextResponse } from "next/server"

const APP_ROUTES = ["/dashboard", "/contacts", "/companies", "/deals", "/tasks", "/team", "/settings", "/onboarding"]
const AUTH_ROUTES = ["/login", "/signup"]

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies
    .getAll()
    .some((c) => c.name === "yb_session" || c.name.startsWith("sb-"))
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const session = hasSessionCookie(req)

  if (!session && APP_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }

  if (session && AUTH_ROUTES.includes(pathname)) {
    const url = req.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/onboarding",
    "/dashboard/:path*",
    "/contacts/:path*",
    "/companies/:path*",
    "/deals/:path*",
    "/tasks/:path*",
    "/team/:path*",
    "/settings/:path*",
  ],
}
