"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"

import { Logo } from "@/components/brand"
import { Field } from "@/components/shared/field"
import { Button } from "@/components/ui/button"
import { api, ApiClientError } from "@/lib/api-client"

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const nextParam = params.get("next")
  const inviteToken = params.get("invite")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api("/api/auth/login", { method: "POST", body: { email, password } })
      const target = inviteToken
        ? `/invite/${inviteToken}`
        : nextParam && nextParam.startsWith("/")
          ? nextParam
          : "/dashboard"
      router.replace(target)
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message)
      else setError("Something went wrong — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl shadow-primary/5">
      <div className="mb-6 flex items-center justify-between">
        <Logo gradientId="login-logo" />
        <Link href="/" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
          Back to home
        </Link>
      </div>
      <h1 className="text-xl font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to your YourBiz CRM workspace.</p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@yourcompany.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="relative">
          <Field
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
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

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting || !email || !password}>
          {submitting ? "Signing you in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to YourBiz CRM?{" "}
        <Link
          href={inviteToken ? `/signup?invite=${inviteToken}` : "/signup"}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create a free account
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 mesh-light opacity-80" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-6">
        <Suspense fallback={<div className="h-96" />}>
          <LoginForm />
        </Suspense>
      </div>
      <footer className="relative z-10 mt-auto text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} YourBiz CRM · Made for India, built for the world
      </footer>
    </div>
  )
}
