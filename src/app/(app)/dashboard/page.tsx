"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Handshake,
  ListTodo,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react"
import { useApp } from "@/components/app/app-provider"
import { DateText } from "@/components/shared/date-text"
import { Money, MultiCurrencyTotal } from "@/components/shared/money"
import { OwnerAvatar } from "@/components/shared/owner-avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState, CardGridSkeleton } from "@/components/shared/states"
import { PageHeader } from "@/components/shared/page-header"
import { PriorityDot } from "@/components/shared/status-chips"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useApiData } from "@/hooks/use-api-data"
import { formatMoney } from "@/lib/i18n"
import type { DashboardData } from "@/lib/types"

function KpiCard({
  label,
  children,
  sub,
  icon: Icon,
  iconClass,
}: {
  label: string
  children: React.ReactNode
  sub: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{children}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

function StageBars({ data }: { data: DashboardData }) {
  const max = Math.max(...data.stages.map((s) => s.count), 1)
  return (
    <div className="space-y-3">
      {data.stages.map((stage) => (
        <Link
          key={stage.id}
          href="/deals"
          className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60"
        >
          <span className="w-28 shrink-0 truncate text-sm font-medium capitalize group-hover:text-primary">
            {stage.name}
          </span>
          <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted">
            <div
              className={`h-full rounded-md transition-all ${
                stage.kind === "won"
                  ? "bg-emerald-500/80"
                  : stage.kind === "lost"
                    ? "bg-rose-400/80"
                    : "bg-primary/70"
              }`}
              style={{ width: `${Math.max((stage.count / max) * 100, stage.count > 0 ? 6 : 0)}%` }}
              aria-hidden="true"
            />
            {stage.count > 0 && (
              <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-foreground/70">
                {stage.count}
              </span>
            )}
          </div>
          <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
            {stage.value.length > 0 ? <MultiCurrencyTotal entries={stage.value} /> : "—"}
          </span>
        </Link>
      ))}
    </div>
  )
}

function WonTrend({ data }: { data: DashboardData }) {
  const max = Math.max(...data.wonTrend.map((m) => m.value), 1)
  const hasAny = data.wonTrend.some((m) => m.value > 0)
  return (
    <div className="flex h-36 items-end gap-2">
      {data.wonTrend.map((month, i) => (
        <div key={`${month.label}-${i}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-primary/70 to-emerald-400/70 transition-all"
            style={{ height: `${Math.max((month.value / max) * 100, month.value > 0 ? 5 : 2)}%` }}
            title={`${month.label}: ${formatMoney(month.value, data.baseCurrency, { compact: true })} (approx)`}
            aria-hidden="true"
          />
          <span className="text-[10px] text-muted-foreground">{month.label}</span>
        </div>
      ))}
      {!hasAny && (
        <p className="mb-16 w-full self-center text-center text-xs text-muted-foreground">
          No deals won yet — your first win will show up here.
        </p>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { activeWorkspace, user, workspaces, switchWorkspace } = useApp()
  const { data, loading, error, reload } = useApiData<DashboardData>("/api/dashboard")

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
        <CardGridSkeleton cards={4} />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (error || !data) {
    return <ErrorState message={error ?? "Could not load your dashboard"} onRetry={reload} />
  }

  const freshWorkspace =
    data.counts.contacts === 0 && data.counts.openDeals === 0 && data.counts.openTasks === 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0] ?? "there"}`}
        description={`Here's what's happening in ${activeWorkspace?.name ?? "your workspace"}. All amounts use each deal's own currency — approx totals in ${data.baseCurrency}.`}
        actions={
          <Button variant="outline" onClick={() => router.push("/contacts")}>
            <UserPlus aria-hidden="true" /> Add contact
          </Button>
        }
      />

      {freshWorkspace && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">Set up in 3 quick steps</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a contact, drag a deal to Won, invite a teammate — your dashboard fills up as you go.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => router.push("/contacts")}>
                Add first contact
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push("/team")}>
                Invite teammate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Open pipeline"
          icon={TrendingUp}
          iconClass="bg-primary/10 text-primary"
          sub={
            data.openPipeline.length > 0 && data.approxOpenPipelineBase > 0
              ? `≈ ${formatMoney(data.approxOpenPipelineBase, data.baseCurrency, { compact: true })} in ${data.baseCurrency}`
              : "No open deals yet"
          }
        >
          {data.openPipeline.length > 0 ? (
            <MultiCurrencyTotal entries={data.openPipeline} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </KpiCard>
        <KpiCard
          label={`Won this month`}
          icon={Handshake}
          iconClass="bg-emerald-500/10 text-emerald-600"
          sub={`${data.counts.openDeals} open deals · ${data.counts.members} ${data.counts.members === 1 ? "member" : "members"}`}
        >
          {data.wonThisMonth.length > 0 ? (
            <MultiCurrencyTotal entries={data.wonThisMonth} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </KpiCard>
        <KpiCard
          label="Contacts"
          icon={Users}
          iconClass="bg-amber-500/10 text-amber-600"
          sub={`${data.counts.newContacts7d} added this week`}
        >
          {data.counts.contacts}
        </KpiCard>
        <KpiCard
          label="Open tasks"
          icon={ListTodo}
          iconClass={
            data.counts.overdueTasks > 0
              ? "bg-rose-500/10 text-rose-600"
              : "bg-teal-500/10 text-teal-600"
          }
          sub={
            data.counts.overdueTasks > 0
              ? `${data.counts.overdueTasks} overdue — needs your attention`
              : "Nothing overdue. Keep it up."
          }
        >
          {data.counts.openTasks}
        </KpiCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Pipeline by stage</CardTitle>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <Link href="/deals">
                Open board <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.stages.length === 0 ? (
              <EmptyState
                icon={Handshake}
                title="No stages yet"
                description="Your deal pipeline stages will appear here once the workspace is set up."
                className="border-0 bg-transparent"
              />
            ) : (
              <StageBars data={data} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Won deals · last 6 months</CardTitle>
          </CardHeader>
          <CardContent>
            <WonTrend data={data} />
            <p className="mt-3 text-[10px] text-muted-foreground">
              Bars are approximate, converted to {data.baseCurrency} with indicative rates.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Upcoming &amp; overdue tasks</CardTitle>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <Link href="/tasks">
                All tasks <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {data.upcomingTasks.length === 0 ? (
              <EmptyState
                icon={ListTodo}
                title="Nothing due in the next 7 days"
                description="Create tasks with due dates and they'll show up here, in every teammate's local timezone."
                className="mx-6 mb-6 border-0 bg-transparent"
              />
            ) : (
              <ul className="max-h-80 divide-y overflow-y-auto scrollbar-thin">
                {data.upcomingTasks.map((task) => {
                  const overdue = task.dueAt ? new Date(task.dueAt).getTime() < Date.now() : false
                  return (
                    <li key={task.id} className="flex items-center gap-3 px-6 py-3">
                      <PriorityDot priority={task.priority} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {task.contactName ? `${task.contactName} · ` : ""}
                          {task.assigneeName ? `Assigned to ${task.assigneeName}` : "Unassigned"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          overdue
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                        }`}
                      >
                        <DateText iso={task.dueAt} style="date" timezone={user?.timezone} />
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {data.activity.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No activity yet"
                description="Every contact you add, deal you move and task you finish appears here."
                className="mx-6 mb-6 border-0 bg-transparent"
              />
            ) : (
              <ul className="max-h-80 divide-y overflow-y-auto scrollbar-thin">
                {data.activity.map((item, index) => (
                  <li key={`${item.type}-${item.id}-${index}`} className="flex items-center gap-3 px-6 py-3">
                    <OwnerAvatar name={item.title} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={
                          item.type === "contact"
                            ? `/contacts/${item.id}`
                            : item.type === "deal"
                              ? "/deals"
                              : item.type === "task"
                                ? "/tasks"
                                : "/team"
                        }
                        className="truncate text-sm font-medium hover:text-primary hover:underline"
                      >
                        {item.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                    <DateText iso={item.at} style="relative" timezone={user?.timezone} className="shrink-0 text-xs text-muted-foreground" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {workspaces.length > 1 && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              You are part of {workspaces.length} workspaces. Data above belongs to{" "}
              <span className="font-medium text-foreground">{activeWorkspace?.name}</span> only.
            </p>
            <div className="flex flex-wrap gap-2">
              {workspaces.map((ws) => (
                <Button
                  key={ws.id}
                  size="sm"
                  variant={ws.id === activeWorkspace?.id ? "default" : "outline"}
                  onClick={() => {
                    if (ws.id !== activeWorkspace?.id) void switchWorkspace(ws.id)
                  }}
                >
                  {ws.id === activeWorkspace?.id ? <Circle className="size-3 fill-current" aria-hidden="true" /> : null}
                  {ws.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
