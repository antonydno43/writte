"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Globe2, Handshake, ListTodo } from "lucide-react"

import { Logo } from "@/components/brand"
import { Field } from "@/components/shared/field"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, ApiClientError } from "@/lib/api-client"
import { CURRENCIES, listTimezones } from "@/lib/i18n"

const TIMEZONES = listTimezones()

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const inviteToken = params.get("invite")
  const inviteEmail = params.get("email")
  const nextParam = params.get("next")

  const [name, setName] = useState("")
  const [email, setEmail] = useState(inviteEmail ?? "")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [timezone, setTimezone] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return "UTC"
    }
  })
  const [currency, setCurrency] = useState("INR")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsVerification, setNeedsVerification] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await api<{ needsVerification: boolean }>("/api/auth/signup", {
        method: "POST",
        body: { name, email, password, timezone, currency },
      })
      if (result.needsVerification) {
        setNeedsVerification(true)
        return
      }
      if (inviteToken) {
        try {
          await api(`/api/invitations/${inviteToken}/accept`, { method: "POST" })
        } catch {
          /* invite might be invalid — continue to onboarding */
        }
      }
      router.replace(nextParam ?? (inviteToken ? "/dashboard" : "/onboarding"))
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message)
      else setError("Something went wrong — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (needsVerification) {
    return (
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-xl shadow-primary/5">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Globe2 className="size-7" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold">Check your inbox</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Click it to
          activate your YourBiz CRM account, then sign in below.
        </p>
        <Button asChild className="mt-6 w-full" variant="outline">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl shadow-primary/5">
      {inviteToken && (
        <div className="mb-5 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-primary">
          You are joining a shared workspace. Create your account and you will land right inside it.
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <Logo gradientId="signup-logo" />
        <Link href="/" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
          Back to home
        </Link>
      </div>
      <h1 className="text-xl font-semibold">Create your free account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        No credit card. Start in under a minute — we prefill your timezone &amp; currency.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Priya Sharma"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
        />
        <Field
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="priya@yourcompany.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="relative">
          <Field
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            hint="Use 8+ characters with a mix of letters and numbers."
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-[30px] rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="tz-select" className="text-sm font-medium text-foreground">
              Timezone
            </label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="tz-select" aria-label="Timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cur-select" className="text-sm font-medium text-foreground">
              Currency
            </label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="cur-select" aria-label="Currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol ? `${c.symbol} ` : ""}
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting || name.length < 2 || !email || password.length < 8}>
          {submitting ? "Creating your account…" : "Create free account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={inviteToken ? `/login?invite=${inviteToken}` : "/login"}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}

export default function SignupPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mesh-light opacity-80"
      />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 py-6">
        <div className="hidden max-w-md text-center sm:flex sm:flex-col sm:gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Welcome to YourBiz CRM</h2>
        <p className="text-sm text-muted-foreground">
          Join thousands of growing teams — organise leads, drag deals to Done, and never miss a follow-up.
        </p>
        <ul className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <Handshake className="size-3.5 text-primary" aria-hidden="true" /> Deal pipeline included
          </li>
          <li className="flex items-center gap-1.5">
            <ListTodo className="size-3.5 text-primary" aria-hidden="true" /> Tasks & reminders
          </li>
          <li className="flex items-center gap-1.5">
            <Globe2 className="size-3.5 text-primary" aria-hidden="true" /> Multi-timezone
          </li>
        </ul>
      </div>
        <div className="w-full max-w-md">
          <Suspense fallback={<div className="h-96" />}>
            <SignupForm />
          </Suspense>
        </div>
      </div>
      <footer className="relative z-10 mt-auto text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} YourBiz CRM · Made for India, built for the world
      </footer>
    </div>
  )
}
