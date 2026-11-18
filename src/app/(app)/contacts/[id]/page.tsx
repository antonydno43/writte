"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  Circle,
  KanbanSquare,
  Mail,
  MapPin,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { useApp } from "@/components/app/app-provider"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DateText } from "@/components/shared/date-text"
import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { OwnerAvatar } from "@/components/shared/owner-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { ContactStatusChip, PriorityDot } from "@/components/shared/status-chips"
import { ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { useApiData } from "@/hooks/use-api-data"
import { api, ApiClientError } from "@/lib/api-client"
import type { ContactDetail } from "@/lib/types"

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-1 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

function AddTaskInline({ contactId, onSaved }: { contactId: string; onSaved: () => void }) {
  const [title, setTitle] = useState("")
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim().length < 2) return
    setSaving(true)
    try {
      await api("/api/tasks", { method: "POST", body: { title: title.trim(), contactId } })
      toast.success("Task added")
      setTitle("")
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not add the task")
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a follow-up task…"
        aria-label="New task for this contact"
        className="h-9 w-full rounded-lg border bg-background px-3 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-ring"
        maxLength={160}
      />
      <Button type="submit" size="icon" variant="ghost" disabled={saving || title.trim().length < 2} aria-label="Add task">
        <Plus className="size-4" aria-hidden="true" />
      </Button>
    </form>
  )
}

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useApp()
  const { data, loading, error, reload } = useApiData<ContactDetail>(`/api/contacts/${id}`)
  const [noteBody, setNoteBody] = useState("")
  const [noteSaving, setNoteSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }
  if (error || !data) {
    return <ErrorState message={error ?? "Contact not found"} onRetry={reload} />
  }

  const fullName = `${data.firstName} ${data.lastName}`.trim()

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (noteBody.trim().length === 0) return
    setNoteSaving(true)
    try {
      await api("/api/notes", { method: "POST", body: { entityType: "contact", entityId: id, body: noteBody.trim() } })
      toast.success("Note saved")
      setNoteBody("")
      reload()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not save the note")
    } finally {
      setNoteSaving(false)
    }
  }

  const toggleTask = async (taskId: string, status: "open" | "done") => {
    try {
      await api(`/api/tasks/${taskId}`, { method: "PATCH", body: { status: status === "done" ? "open" : "done" } })
      reload()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not update the task")
    }
  }

  const doDelete = async () => {
    try {
      await api(`/api/contacts/${id}`, { method: "DELETE" })
      toast.success("Contact deleted")
      router.push("/contacts")
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete the contact")
      setConfirmDelete(false)
    }
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 gap-1 text-muted-foreground">
        <Link href="/contacts">
          <ArrowLeft className="size-4" aria-hidden="true" /> All contacts
        </Link>
      </Button>

      <PageHeader
        title={fullName || "Unnamed contact"}
        description={
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <ContactStatusChip status={data.status} />
            {data.jobTitle && <span className="text-xs">{data.jobTitle}</span>}
            {data.companyName && (
              <Link href={`/companies`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Building2 className="size-3.5" aria-hidden="true" /> {data.companyName}
              </Link>
            )}
            <span className="text-xs text-muted-foreground">Added <DateText iso={data.createdAt} style="date" timezone={user?.timezone} /></span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => router.push("/contacts")}>
              <Pencil aria-hidden="true" /> Edit on list
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" aria-hidden="true" /> Delete contact
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <OwnerAvatar name={fullName} size="lg" /> About
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <InfoRow icon={Mail} label="Email" value={data.email ?? "—"} />
            <InfoRow icon={Phone} label="Phone" value={data.phone ?? "—"} />
            <InfoRow icon={Briefcase} label="Job title" value={data.jobTitle ?? "—"} />
            <InfoRow
              icon={MapPin}
              label="Location"
              value={[data.city, data.state, data.country].filter(Boolean).join(", ") || "—"}
            />
            <InfoRow
              icon={Circle}
              label="Owner"
              value={
                <span className="flex items-center gap-2">
                  <OwnerAvatar name={data.ownerName ?? undefined} size="sm" />
                  {data.ownerName ?? "Unassigned"}
                </span>
              }
            />
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <KanbanSquare className="size-4 text-primary" aria-hidden="true" /> Deals
              </CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href={`/deals?contactId=${id}&name=${encodeURIComponent(fullName)}`}>
                  <Plus aria-hidden="true" /> New deal
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="px-0">
              {data.deals.length === 0 ? (
                <EmptyState
                  icon={KanbanSquare}
                  title="No deals yet"
                  description={`Start a deal for ${data.firstName || "this contact"} and drag it through your pipeline.`}
                  className="mx-6 mb-6 border-0 bg-transparent"
                />
              ) : (
                <ul className="divide-y">
                  {data.deals.map((deal) => (
                    <li key={deal.id} className="flex items-center gap-3 px-6 py-3">
                      <span className="min-w-0 flex-1">
                        <Link href={`/deals?highlight=${deal.id}`} className="truncate text-sm font-medium hover:text-primary hover:underline">
                          {deal.title}
                        </Link>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {deal.stageName}
                          {deal.expectedCloseDate && (
                            <>
                              · closes <DateText iso={deal.expectedCloseDate} style="date" timezone={user?.timezone} />
                            </>
                          )}
                        </span>
                      </span>
                      <Money amount={deal.amount} currency={deal.currency} compact className="shrink-0 text-sm font-semibold" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" /> Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {data.tasks.length === 0 ? (
                <div className="px-6 pb-6">
                  <AddTaskInline contactId={id} onSaved={reload} />
                  <p className="mt-3 text-xs text-muted-foreground">No tasks yet — add the first follow-up above.</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {data.tasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-3 px-6 py-3">
                      <button
                        type="button"
                        onClick={() => void toggleTask(task.id, task.status)}
                        aria-label={task.status === "done" ? "Reopen task" : "Complete task"}
                        className="rounded-full transition-transform hover:scale-110"
                      >
                        {task.status === "done" ? (
                          <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />
                        ) : (
                          <Circle className="size-5 text-muted-foreground/50" aria-hidden="true" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}>
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {task.assigneeName ? `Assigned to ${task.assigneeName}` : "Unassigned"}
                          {task.dueAt && (
                            <>
                              {" · due "}
                              <DateText iso={task.dueAt} style="date" timezone={user?.timezone} />
                            </>
                          )}
                        </p>
                      </div>
                      <PriorityDot priority={task.priority} />
                    </li>
                  ))}
                  <li className="px-6 py-3">
                    <AddTaskInline contactId={id} onSaved={reload} />
                  </li>
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <NotebookPen className="size-4 text-primary" aria-hidden="true" /> Notes &amp; activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={addNote} className="mb-4">
                <Textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder={`Log a call, meeting or anything worth remembering about ${data.firstName || "them"}…`}
                  aria-label="New note"
                  rows={2}
                  maxLength={2000}
                  className="resize-none"
                />
                <div className="mt-2 flex justify-end">
                  <Button type="submit" size="sm" disabled={noteSaving || noteBody.trim().length === 0}>
                    {noteSaving ? "Saving…" : "Save note"}
                  </Button>
                </div>
              </form>
              {data.notes.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No notes yet. Notes are visible to your whole workspace — great for shared context.
                </p>
              ) : (
                <ul className="space-y-4">
                  {data.notes.map((note) => (
                    <li key={note.id} className="rounded-xl border bg-muted/30 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                          <OwnerAvatar name={note.authorName} size="sm" />
                          {note.authorName}
                        </span>
                        <DateText iso={note.createdAt} style="datetime" timezone={user?.timezone} className="text-xs text-muted-foreground" />
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{note.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${fullName}?`}
        description="This removes the contact for your whole workspace. Their deals and tasks stay, but unlinked. This cannot be undone."
        confirmLabel="Delete contact"
        onConfirm={() => void doDelete()}
      />
    </div>
  )
}
