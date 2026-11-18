"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Clock, MailOpen, ShieldAlert } from "lucide-react"

import { Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { api, ApiClientError } from "@/lib/api-client"
import { DateText } from "@/components/shared/date-text"
import type { InvitationInfo } from "@/lib/types"

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [me, setMe] = useState<{ email: string | null } | null>(null)
  const [state, setState] = useState<"loading" | "error" | "ready" | "done">("loading")
  const [joining, setJoining] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [invRes, meRes] = await Promise.all([
          api<{ invitation: InvitationInfo | null }>(`/api/invitations/${token}`),
          api<{ user: { email: string } | null }>("/api/auth/me"),
        ])
        if (!alive) return
        if (!invRes.invitation) {
          setState("error")
          setMessage("This invitation link is invalid or was revoked.")
          return
        }
        setInfo(invRes.invitation)
        setMe({ email: meRes.user?.email ?? null })
        setState("ready")
      } catch (err) {
        if (!alive) return
        setState("error")
        setMessage(err instanceof ApiClientError ? err.message : "Could not load this invitation.")
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const accept = async () => {
    if (!info) return
    setJoining(true)
    try {
      await api(`/api/invitations/${token}/accept`, { method: "POST" })
      setState("done")
      setTimeout(() => router.replace("/dashboard"), 1400)
    } catch (err) {
      setJoining(false)
      setMessage(err instanceof ApiClientError ? err.message : "Could not accept this invitation.")
    }
  }

  const emailMatches = me?.email && info ? me.email.toLowerCase() === info.email.toLowerCase() : null
  const statusInvalid =
    info && info.status !== "pending" ? info.status === "accepted" ? "already" : "inactive" : null

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 mesh-light opacity-80" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-6">
        <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo gradientId="invite-logo" />
        </div>

        {state === "loading" && (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-xl shadow-primary/5">
            <div className="mx-auto size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" aria-hidden="true" />
            <p className="mt-4 text-sm text-muted-foreground" role="status">
              Opening your invitation…
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-xl shadow-primary/5">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="size-7" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold">Invitation unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </div>
        )}

        {state === "done" && (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-xl shadow-primary/5">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-7" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold">You&apos;re in</h1>
            <p className="mt-2 text-sm text-muted-foreground">Welcome to the team — opening your workspace…</p>
          </div>
        )}

        {state === "ready" && info && (
          <div className="rounded-2xl border bg-card p-8 shadow-xl shadow-primary/5">
            <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailOpen className="size-7" aria-hidden="true" />
            </div>
            <h1 className="text-center text-xl font-semibold">
              Join <span className="text-primary">{info.workspaceName}</span>
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {info.inviterName} invited <span className="font-medium text-foreground">{info.email}</span> to
              collaborate on YourBiz CRM as a <span className="capitalize">{info.role}</span>.
            </p>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" aria-hidden="true" />
              Expires <DateText iso={info.expiresAt} style="date" />
            </p>

            <div className="mt-6 space-y-3">
              {statusInvalid === "already" ? (
                <>
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                    You already accepted this invitation.
                  </p>
                  <Button className="w-full" asChild>
                    <Link href="/dashboard">Open workspace</Link>
                  </Button>
                </>
              ) : statusInvalid ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  This invitation is {statusInvalid}. Ask a workspace admin to send a new one.
                </p>
              ) : emailMatches === null ? (
                <>
                  <p className="text-center text-sm text-muted-foreground">
                    Sign in as <span className="font-medium text-foreground">{info.email}</span> (or create that
                    account) to accept.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button asChild variant="outline">
                      <Link href={`/login?invite=${token}`}>I have an account</Link>
                    </Button>
                    <Button asChild>
                      <Link href={`/signup?invite=${token}&email=${encodeURIComponent(info.email)}`}>
                        Create my account
                      </Link>
                    </Button>
                  </div>
                </>
              ) : emailMatches ? (
                <Button className="w-full" onClick={() => void accept()} disabled={joining}>
                  {joining ? "Joining…" : "Accept & open workspace"}
                </Button>
              ) : (
                <>
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    You are signed in as {me?.email}, but this invitation was sent to {info.email}. Sign out and
                    use that account (or create it) to accept.
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/login?invite=${token}`}>Sign in with the invited account</Link>
                  </Button>
                </>
              )}

              {message && state === "ready" && (
                <p role="alert" className="text-center text-sm text-destructive">
                  {message}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
      <footer className="relative z-10 mt-auto text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} YourBiz CRM · Made for India, built for the world
      </footer>
    </div>
  )
}
