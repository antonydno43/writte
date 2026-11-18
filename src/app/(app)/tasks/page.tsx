"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CalendarClock, CheckCircle2, Circle, ListTodo, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { useApp } from "@/components/app/app-provider"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DateText } from "@/components/shared/date-text"
import { EmptyState } from "@/components/shared/empty-state"
import { Field } from "@/components/shared/field"
import { OwnerAvatar } from "@/components/shared/owner-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { PriorityDot } from "@/components/shared/status-chips"
import { ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useApiData } from "@/hooks/use-api-data"
import { api, ApiClientError } from "@/lib/api-client"
import type { Contact, Task, TaskPriority, WorkspaceMember } from "@/lib/types"

interface FormState {
  title: string
  description: string
  priority: TaskPriority
  dueLocal: string
  assigneeId: string
  contactId: string
}

const EMPTY: FormState = {
  title: "",
  description: "",
  priority: "normal",
  dueLocal: "",
  assigneeId: "me",
  contactId: "none",
}

function TaskDialog({
  open,
  onOpenChange,
  members,
  contacts,
  saved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: WorkspaceMember[]
  contacts: Contact[]
  saved: () => void
}) {
  const { user } = useApp()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // reset each time it opens
  const [wasOpen, setWasOpen] = useState(false)
  if (open && !wasOpen) {
    setWasOpen(true)
    setForm({ ...EMPTY, assigneeId: user?.id ?? "me" })
    setError(null)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const dueAt = form.dueLocal ? new Date(form.dueLocal).toISOString() : null
    try {
      await api("/api/tasks", {
        method: "POST",
        body: {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          priority: form.priority,
          dueAt,
          assigneeId: form.assigneeId !== "none" ? form.assigneeId : null,
          contactId: form.contactId !== "none" ? form.contactId : null,
        },
      })
      toast.success("Task added")
      onOpenChange(false)
      saved()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save the task. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Due dates are entered in your timezone ({user?.timezone.replace(/_/g, " ") ?? "local"}) and shown to
            every teammate in theirs.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field
            label="What needs to happen?"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Call Rahul about the sample shipment"
            required
            minLength={2}
            autoFocus
          />
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Optional details your teammates might need…"
            aria-label="Task description"
            rows={2}
            maxLength={2000}
            className="resize-none"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Due (your timezone)"
              type="datetime-local"
              value={form.dueLocal}
              onChange={(e) => set("dueLocal", e.target.value)}
            />
            <div className="space-y-1.5">
              <label htmlFor="task-priority" className="text-sm font-medium text-foreground">
                Priority
              </label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v as TaskPriority)}>
                <SelectTrigger id="task-priority" aria-label="Priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="task-assignee" className="text-sm font-medium text-foreground">
                Assign to
              </label>
              <Select value={form.assigneeId} onValueChange={(v) => set("assigneeId", v)}>
                <SelectTrigger id="task-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.name} {m.role !== "member" ? `(${m.role})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="task-contact" className="text-sm font-medium text-foreground">
                Related contact
              </label>
              <Select value={form.contactId} onValueChange={(v) => set("contactId", v)}>
                <SelectTrigger id="task-contact">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="none">None</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {`${c.firstName} ${c.lastName}`.trim()}
                      {c.companyName ? ` · ${c.companyName}` : ""}
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || form.title.trim().length < 2}>
              {saving ? "Saving…" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task
  onToggle: (task: Task) => void
  onDelete: (task: Task) => void
}) {
  const { user } = useApp()
  const overdue = task.dueAt && task.status === "open" && new Date(task.dueAt).getTime() < Date.now()
  const today =
    task.dueAt &&
    new Date(task.dueAt).toDateString() === new Date().toDateString()
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-muted/40">
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-label={task.status === "done" ? `Reopen "${task.title}"` : `Complete "${task.title}"`}
        className="rounded-full transition-transform hover:scale-110 active:scale-95"
      >
        {task.status === "done" ? (
          <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />
        ) : (
          <Circle className="size-5 text-muted-foreground/50 hover:text-primary" aria-hidden="true" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            task.status === "done" ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {task.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 truncate text-xs text-muted-foreground">
          {task.assigneeName ? (
            <span className="flex items-center gap-1">
              <OwnerAvatar name={task.assigneeName} size="sm" /> {task.assigneeName}
            </span>
          ) : (
            "Unassigned"
          )}
          {task.contactId && task.contactName && (
            <Link href={`/contacts/${task.contactId}`} className="hover:text-primary hover:underline">
              {task.contactName}
            </Link>
          )}
          {task.dealId && task.dealTitle && (
            <Link href="/deals" className="hover:text-primary hover:underline">
              {task.dealTitle}
            </Link>
          )}
        </p>
      </div>
      <PriorityDot priority={task.priority} />
      {task.dueAt && (
        <span
          className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex ${
            overdue
              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
              : today
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                : "bg-muted text-muted-foreground"
          }`}
        >
          <CalendarClock className="size-3" aria-hidden="true" />
          <DateText iso={task.dueAt} style={overdue || today ? "date" : "datetime"} timezone={user?.timezone} />
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(task)}
        aria-label={`Delete task "${task.title}"`}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
    </li>
  )
}

export default function TasksPage() {
  const { user } = useApp()
  const [filter, setFilter] = useState<"open" | "done" | "all">("open")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)

  const { data, loading, error, reload } = useApiData<{ items: Task[]; total: number }>("/api/tasks?limit=200")
  const { data: teamData } = useApiData<{ members: WorkspaceMember[] }>(dialogOpen ? "/api/team" : null)
  const { data: contactsData } = useApiData<{ items: Contact[] }>(dialogOpen ? "/api/contacts?limit=200" : null)

  const tasks = data?.items ?? []
  const visible = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((t) => t.status === filter)),
    [tasks, filter]
  )

  const groups = useMemo(() => {
    const now = Date.now()
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    const overdue: Task[] = []
    const today: Task[] = []
    const upcoming: Task[] = []
    const noDate: Task[] = []
    for (const t of visible) {
      if (!t.dueAt) noDate.push(t)
      else {
        const time = new Date(t.dueAt).getTime()
        if (time < now && t.status === "open") overdue.push(t)
        else if (time <= endOfToday.getTime()) today.push(t)
        else upcoming.push(t)
      }
    }
    return { overdue, today, upcoming, noDate }
  }, [visible])

  const toggle = async (task: Task) => {
    try {
      await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: { status: task.status === "done" ? "open" : "done" },
      })
      reload()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not update the task")
    }
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    try {
      await api(`/api/tasks/${deleteTarget.id}`, { method: "DELETE" })
      toast.success("Task deleted")
      setDeleteTarget(null)
      reload()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete the task")
    }
  }

  const hasAny = visible.length > 0

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Follow-ups, reminders and to-dos — with dates that follow each teammate's timezone."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus aria-hidden="true" /> New task
          </Button>
        }
      />

      <div className="mb-4 inline-flex rounded-full border bg-card p-1" role="group" aria-label="Filter tasks">
        {(["open", "done", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "open" ? "Open" : f === "done" ? "Completed" : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !hasAny ? (
        <EmptyState
          icon={ListTodo}
          title={filter === "open" ? "No open tasks" : filter === "done" ? "Nothing completed yet" : "No tasks yet"}
          description="Create tasks with due dates — overdue items turn red so they're impossible to miss."
          action={{ label: "New task", onClick: () => setDialogOpen(true) }}
        />
      ) : (
        <div className="space-y-6">
          {groups.overdue.length > 0 && (
            <Card className="border-rose-200 dark:border-rose-900/60">
              <CardContent className="px-4 py-2">
                <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                  Overdue · {groups.overdue.length}
                </p>
                <ul className="divide-y">
                  {groups.overdue.map((task) => (
                    <TaskRow key={task.id} task={task} onToggle={toggle} onDelete={setDeleteTarget} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {groups.today.length > 0 && (
            <Card>
              <CardContent className="px-4 py-2">
                <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  Today · {groups.today.length}
                </p>
                <ul className="divide-y">
                  {groups.today.map((task) => (
                    <TaskRow key={task.id} task={task} onToggle={toggle} onDelete={setDeleteTarget} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {groups.upcoming.length > 0 && (
            <Card>
              <CardContent className="px-4 py-2">
                <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Upcoming · {groups.upcoming.length}
                </p>
                <ul className="divide-y">
                  {groups.upcoming.map((task) => (
                    <TaskRow key={task.id} task={task} onToggle={toggle} onDelete={setDeleteTarget} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {groups.noDate.length > 0 && (
            <Card>
              <CardContent className="px-4 py-2">
                <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  No date · {groups.noDate.length}
                </p>
                <ul className="divide-y">
                  {groups.noDate.map((task) => (
                    <TaskRow key={task.id} task={task} onToggle={toggle} onDelete={setDeleteTarget} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Times shown in your timezone ({user?.timezone.replace(/_/g, " ") ?? "local"}) — teammates see their own.
          </p>
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={teamData?.members ?? []}
        contacts={contactsData?.items ?? []}
        saved={reload}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete “${deleteTarget?.title ?? "task"}”?`}
        description="This removes the task for everyone in the workspace. This cannot be undone."
        confirmLabel="Delete task"
        onConfirm={() => void doDelete()}
      />
    </div>
  )
}
