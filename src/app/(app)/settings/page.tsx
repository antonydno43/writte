"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ChevronDown, ChevronUp, Clock, Coins, Globe2, KeyRound, Plus, Trash2, UserRound, Workflow } from "lucide-react"
import { toast } from "sonner"

import { useApp } from "@/components/app/app-provider"
import { Field } from "@/components/shared/field"
import { ErrorState } from "@/components/shared/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApiData } from "@/hooks/use-api-data"
import { api, ApiClientError } from "@/lib/api-client"
import { CURRENCIES, listTimezones } from "@/lib/i18n"
import type { PipelineStage } from "@/lib/types"

const TIMEZONES = listTimezones()

function CurrentTimeHint({ timezone }: { timezone: string }) {
  const [time, setTime] = useState<string | null>(null)
  useEffect(() => {
    const tick = () => {
      try {
        setTime(
          new Intl.DateTimeFormat("en-GB", {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          }).format(new Date())
        )
      } catch {
        setTime(null)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timezone])
  return (
    <p className="text-xs text-muted-foreground">
      It is {time ?? "—"} there right now{time ? "" : " (pick a timezone to preview)"}
    </p>
  )
}

function ProfileTab() {
  const { user, refresh } = useApp()
  const [name, setName] = useState(user?.name ?? "")
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC")
  const [currency, setCurrency] = useState(user?.currency ?? "INR")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setTimezone(user.timezone)
      setCurrency(user.currency)
    }
  }, [user])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api("/api/auth/profile", { method: "PATCH", body: { name, timezone, currency } })
      toast.success("Profile saved")
      await refresh()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not save your profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4 text-primary" aria-hidden="true" /> Personal details
          </CardTitle>
          <CardDescription>Visible to teammates in your workspaces.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          <Field label="Email" value={user?.email ?? ""} readOnly disabled hint="Your sign-in email — cannot be changed here." />
          <Button type="submit" disabled={saving || name.trim().length < 2}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe2 className="size-4 text-primary" aria-hidden="true" /> Preferences
          </CardTitle>
          <CardDescription>Times and amounts you personally see across YourBiz.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="settings-tz" className="text-sm font-medium text-foreground">
              <Clock className="mr-1 inline size-3.5 text-muted-foreground" aria-hidden="true" /> My timezone
            </label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="settings-tz" aria-label="Timezone">
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
            <CurrentTimeHint timezone={timezone} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="settings-currency" className="text-sm font-medium text-foreground">
              <Coins className="mr-1 inline size-3.5 text-muted-foreground" aria-hidden="true" /> My display currency
            </label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="settings-currency" aria-label="Display currency">
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
            <p className="text-xs text-muted-foreground">
              Deals always keep the currency they were created with — this is only your personal default.
            </p>
          </div>
          <Button type="submit" variant="outline" disabled={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}

function WorkspaceTab() {
  const { activeWorkspace, refresh, mode } = useApp()
  const [name, setName] = useState(activeWorkspace?.name ?? "")
  const [baseCurrency, setBaseCurrency] = useState(activeWorkspace?.baseCurrency ?? "INR")
  const [timezone, setTimezone] = useState(activeWorkspace?.timezone ?? "UTC")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (activeWorkspace) {
      setName(activeWorkspace.name)
      setBaseCurrency(activeWorkspace.baseCurrency)
      setTimezone(activeWorkspace.timezone)
    }
  }, [activeWorkspace])

  if (!activeWorkspace) return <ErrorState message="No active workspace" />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api("/api/workspaces/current", { method: "PATCH", body: { name, baseCurrency, timezone } })
      toast.success("Workspace settings saved")
      await refresh()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not save workspace settings")
    } finally {
      setSaving(false)
    }
  }

  const canAdmin = activeWorkspace.role === "owner" || activeWorkspace.role === "admin"

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">Workspace</CardTitle>
        <CardDescription>
          {activeWorkspace.role === "owner"
            ? "You own this workspace."
            : activeWorkspace.role === "admin"
              ? "You are an admin of this workspace."
              : "Only owners and admins can change these."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field
          label="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          disabled={!canAdmin}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="ws-currency" className="text-sm font-medium text-foreground">
              Base currency for reports
            </label>
            <Select value={baseCurrency} onValueChange={setBaseCurrency} disabled={!canAdmin}>
              <SelectTrigger id="ws-currency" aria-label="Base currency">
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
            <p className="text-xs text-muted-foreground">
              Deals in other currencies are converted approximately for totals.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ws-timezone" className="text-sm font-medium text-foreground">
              Workspace timezone (default)
            </label>
            <Select value={timezone} onValueChange={setTimezone} disabled={!canAdmin}>
              <SelectTrigger id="ws-timezone" aria-label="Workspace timezone">
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
            <CurrentTimeHint timezone={timezone} />
          </div>
        </div>
        {mode === "local" && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            Preview mode: data lives locally in this sandbox. In production it lives in your own Supabase database.
          </p>
        )}
        {canAdmin && (
          <Button type="submit" onClick={submit} disabled={saving || name.trim().length < 2}>
            {saving ? "Saving…" : "Save workspace"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

interface StageDraft {
  id?: string
  name: string
  kind: "open" | "won" | "lost"
}

function PipelineTab() {
  const { activeWorkspace } = useApp()
  const { data, loading, error, reload } = useApiData<{ stages: PipelineStage[] }>("/api/stages")
  const [draft, setDraft] = useState<StageDraft[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data?.stages) setDraft(data.stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind })))
  }, [data])

  const canAdmin = activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin"

  const update = (index: number, patch: Partial<StageDraft>) =>
    setDraft((d) => d.map((s, i) => (i === index ? { ...s, ...patch } : s)))

  const addStage = () => setDraft((d) => [...d, { name: "New stage", kind: "open" }])

  const removeStage = (index: number) => setDraft((d) => d.filter((_, i) => i !== index))

  const move = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const next = [...d]
      const target = index + dir
      if (target < 0 || target >= next.length) return d
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const save = async () => {
    setSaving(true)
    try {
      await api("/api/stages", { method: "PUT", body: { stages: draft } })
      toast.success("Pipeline saved")
      reload()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not save the pipeline")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const openCount = draft.filter((s) => s.kind === "open").length
  const wonCount = draft.filter((s) => s.kind === "won").length
  const lostCount = draft.filter((s) => s.kind === "lost").length
  const valid = openCount >= 1 && wonCount === 1 && lostCount === 1

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Workflow className="size-4 text-primary" aria-hidden="true" /> Pipeline stages
        </CardTitle>
        <CardDescription>
          Rename, reorder or add stages to match how your team actually sells. Keep exactly one Won and one Lost.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!canAdmin && <p className="text-sm text-muted-foreground">Only owners and admins can edit the pipeline.</p>}
        {draft.map((stage, index) => (
          <div key={stage.id ?? `new-${index}`} className="flex items-center gap-2">
            <span className="w-6 text-center text-xs text-muted-foreground">{index + 1}</span>
            <input
              value={stage.name}
              onChange={(e) => update(index, { name: e.target.value })}
              disabled={!canAdmin}
              aria-label={`Stage ${index + 1} name`}
              className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
              maxLength={60}
            />
            <select
              value={stage.kind}
              onChange={(e) => update(index, { kind: e.target.value as StageDraft["kind"] })}
              disabled={!canAdmin}
              aria-label={`Stage ${index + 1} type`}
              className="h-9 rounded-lg border border-input bg-background px-2 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
            >
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => move(index, -1)}
                disabled={!canAdmin || index === 0}
                aria-label={`Move ${stage.name} up`}
              >
                <ChevronUp className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => move(index, 1)}
                disabled={!canAdmin || index === draft.length - 1}
                aria-label={`Move ${stage.name} down`}
              >
                <ChevronDown className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeStage(index)}
                disabled={!canAdmin}
                aria-label={`Remove ${stage.name}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
        {canAdmin && (
          <Button type="button" variant="outline" size="sm" onClick={addStage}>
            <Plus aria-hidden="true" /> Add stage
          </Button>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap gap-2 text-xs" aria-live="polite">
            <Badge variant={openCount >= 1 ? "secondary" : "destructive"}>{openCount} open</Badge>
            <Badge variant={wonCount === 1 ? "secondary" : "destructive"}>{wonCount} won</Badge>
            <Badge variant={lostCount === 1 ? "secondary" : "destructive"}>{lostCount} lost</Badge>
          </div>
          {canAdmin && (
            <Button onClick={() => void save()} disabled={saving || !valid}>
              {saving ? "Saving…" : "Save pipeline"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api("/api/auth/password", { method: "POST", body: { currentPassword, newPassword } })
      toast.success("Password updated")
      setCurrentPassword("")
      setNewPassword("")
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not update your password")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4 text-primary" aria-hidden="true" /> Change password
        </CardTitle>
        <CardDescription>Applies to your account across all workspaces.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Field
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            hint="At least 8 characters."
          />
          <Button type="submit" disabled={saving || !currentPassword || newPassword.length < 8}>
            {saving ? "Updating…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function SettingsInner() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") === "workspace" ? "workspace" : "profile"

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account, this workspace and the deal pipeline.</p>
      </div>
      <Tabs defaultValue={initialTab}>
        <TabsList className="mb-6 flex h-auto w-full max-w-2xl flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="profile" className="data-[state=active]:bg-background">
            <UserRound className="mr-1.5 size-4" aria-hidden="true" /> Profile
          </TabsTrigger>
          <TabsTrigger value="workspace" className="data-[state=active]:bg-background">
            <Globe2 className="mr-1.5 size-4" aria-hidden="true" /> Workspace
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="data-[state=active]:bg-background">
            <Workflow className="mr-1.5 size-4" aria-hidden="true" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-background">
            <KeyRound className="mr-1.5 size-4" aria-hidden="true" /> Security
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="workspace">
          <WorkspaceTab />
        </TabsContent>
        <TabsContent value="pipeline">
          <PipelineTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <SettingsInner />
    </Suspense>
  )
}
