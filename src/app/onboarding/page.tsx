"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Globe2, Rocket, Sparkles } from "lucide-react"

import { Logo } from "@/components/brand"
import { AppProvider, useApp } from "@/components/app/app-provider"
import { Field } from "@/components/shared/field"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, ApiClientError } from "@/lib/api-client"
import { CURRENCIES, listTimezones } from "@/lib/i18n"

const TIMEZONES = listTimezones()

function OnboardingForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { user, workspaces, refresh } = useApp()
  const isNew = params.get("new") === "1" || workspaces.length > 0

  const [name, setName] = useState("")
  const [baseCurrency, setBaseCurrency] = useState(user?.currency ?? "INR")
  const [timezone, setTimezone] = useState(
    user?.timezone ??
      (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone
        } catch {
          return "UTC"
        }
      })()
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api("/api/workspaces", { method: "POST", body: { name, baseCurrency, timezone } })
      await refresh()
      router.replace("/dashboard")
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create your workspace. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-xl shadow-primary/5">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Rocket className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">
            {isNew ? "Create a new workspace" : "Let's set up your workspace"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isNew
              ? "Every workspace keeps its own contacts, deals and team — perfect for separate businesses or clients."
              : "30 seconds and you're in. You can change anything later in settings."}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field
          label="Workspace name"
          name="workspace-name"
          placeholder="e.g. Sharma Textiles Pvt Ltd"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          autoFocus
          hint="Usually your company or team name. You can invite teammates next."
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="onb-currency" className="text-sm font-medium text-foreground">
              Main currency
            </label>
            <Select value={baseCurrency} onValueChange={setBaseCurrency}>
              <SelectTrigger id="onb-currency" aria-label="Main currency">
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
          <div className="space-y-1.5">
            <label htmlFor="onb-timezone" className="text-sm font-medium text-foreground">
              Workspace timezone
            </label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="onb-timezone" aria-label="Workspace timezone">
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
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting || name.trim().length < 2}>
          {submitting ? "Creating…" : "Create workspace & start"}
        </Button>
      </form>
    </div>
  )
}

function OnboardingInner() {
  const { status } = useApp()
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 mesh-light opacity-80" />
      {status !== "authenticated" ? (
        <div className="relative z-10 flex flex-1 items-center justify-center py-6">
          <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" aria-hidden="true" />
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-6">
          <div className="mb-8 hidden text-center sm:block">
            <div className="mb-4 flex justify-center">
              <Logo gradientId="onboarding-logo" />
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" /> Create · Invite your team · Start selling
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">Your workspace is your business home</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Contacts, deals and tasks live inside a workspace so your data never mixes with anyone else&apos;s.
            </p>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Globe2 className="size-3.5 text-primary" aria-hidden="true" /> Every teammate still sees times in their own timezone
            </p>
          </div>
          <div className="w-full max-w-lg">
            <Suspense fallback={<div className="h-80" />}>
              <OnboardingForm />
            </Suspense>
          </div>
        </div>
      )}
      <footer className="relative z-10 mt-auto text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} YourBiz CRM
      </footer>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <AppProvider>
      <OnboardingInner />
    </AppProvider>
  )
}
