"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building2, MoreHorizontal, Pencil, Phone, Trash2, UserPlus, Users } from "lucide-react"
import { toast } from "sonner"

import { useApp } from "@/components/app/app-provider"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DateText } from "@/components/shared/date-text"
import { EmptyState } from "@/components/shared/empty-state"
import { Field } from "@/components/shared/field"
import { OwnerAvatar } from "@/components/shared/owner-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { ContactStatusChip } from "@/components/shared/status-chips"
import { ErrorState, TableSkeleton } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApiData } from "@/hooks/use-api-data"
import { api, ApiClientError } from "@/lib/api-client"
import { CONTACT_STATUSES, type Contact, type ContactStatus, type WorkspaceMember } from "@/lib/types"

interface CompanyLite {
  companies: { id: string; name: string }[]
}

interface FormState {
  id?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  jobTitle: string
  status: ContactStatus
  companyId: string
  ownerId: string
  city: string
  state: string
  country: string
}

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  jobTitle: "",
  status: "lead",
  companyId: "none",
  ownerId: "me",
  city: "",
  state: "",
  country: "",
}

function ContactDialog({
  open,
  onOpenChange,
  initial,
  companies,
  members,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: FormState | null
  companies: { id: string; name: string }[]
  members: WorkspaceMember[]
  onSaved: () => void
}) {
  const { user } = useApp()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(initial ?? { ...EMPTY_FORM, ownerId: user?.id ?? "me" })
      setError(null)
    }
  }, [open, initial, user])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      jobTitle: form.jobTitle.trim() || undefined,
      status: form.status,
      companyId: form.companyId !== "none" ? form.companyId : null,
      ownerId: form.ownerId !== "none" ? form.ownerId : null,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      country: form.country.trim() || undefined,
    }
    try {
      if (form.id) {
        await api(`/api/contacts/${form.id}`, { method: "PATCH", body: payload })
        toast.success("Contact updated")
      } else {
        await api("/api/contacts", { method: "POST", body: payload })
        toast.success("Contact added")
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save the contact. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit contact" : "Add a contact"}</DialogTitle>
          <DialogDescription>
            {form.id
              ? "Update this person's details — changes are visible to your whole team instantly."
              : "Every field is optional except the name. You can add the rest later."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="First name"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder="Rahul"
              required
              minLength={1}
              autoFocus
            />
            <Field
              label="Last name"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              placeholder="Verma"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="rahul@company.com"
            />
            <Field label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Job title"
              value={form.jobTitle}
              onChange={(e) => set("jobTitle", e.target.value)}
              placeholder="Purchase Manager"
            />
            <div className="space-y-1.5">
              <label htmlFor="contact-status" className="text-sm font-medium text-foreground">
                Status
              </label>
              <Select value={form.status} onValueChange={(v) => set("status", v as ContactStatus)}>
                <SelectTrigger id="contact-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="contact-company" className="text-sm font-medium text-foreground">
                Company
              </label>
              <Select value={form.companyId} onValueChange={(v) => set("companyId", v)}>
                <SelectTrigger id="contact-company">
                  <SelectValue placeholder="No company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No company</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="contact-owner" className="text-sm font-medium text-foreground">
                Owner (assign to)
              </label>
              <Select value={form.ownerId} onValueChange={(v) => set("ownerId", v)}>
                <SelectTrigger id="contact-owner">
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
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Chennai" />
            <Field label="State" value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="TN" />
            <Field label="Country" value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="India" />
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
            <Button type="submit" disabled={saving || form.firstName.trim().length === 0}>
              {saving ? "Saving…" : form.id ? "Save changes" : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ContactsPage() {
  const router = useRouter()
  const { user, activeWorkspace } = useApp()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [limit] = useState(60)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FormState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 320)
    return () => clearTimeout(t)
  }, [search])

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: String(limit), offset: "0" })
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (status !== "all") params.set("status", status)
    return `/api/contacts?${params.toString()}`
  }, [debouncedSearch, status, limit])

  const { data, loading, error, reload } = useApiData<{ items: Contact[]; total: number }>(query)
  const { data: companiesData } = useApiData<CompanyLite>(dialogOpen ? "/api/companies?limit=200" : null)
  const { data: teamData } = useApiData<{ members: WorkspaceMember[] }>(dialogOpen ? "/api/team" : null)

  const companies = companiesData?.companies ?? []
  const members = teamData?.members ?? []

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (contact: Contact) => {
    setEditing({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      jobTitle: contact.jobTitle ?? "",
      status: contact.status,
      companyId: contact.companyId ?? "none",
      ownerId: contact.ownerId ?? "none",
      city: contact.city ?? "",
      state: contact.state ?? "",
      country: contact.country ?? "",
    })
    setDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/api/contacts/${deleteTarget.id}`, { method: "DELETE" })
      toast.success(`${deleteTarget.firstName} ${deleteTarget.lastName}`.trim() + " removed")
      setDeleteTarget(null)
      reload()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete the contact")
    } finally {
      setDeleting(false)
    }
  }

  const items = data?.items ?? []

  return (
    <div>
      <PageHeader
        title="Contacts"
        description={`Everyone ${activeWorkspace?.name ?? "your team"} sells to — leads, prospects and customers in one place.`}
        actions={
          <Button onClick={openCreate}>
            <UserPlus aria-hidden="true" /> Add contact
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, phone…" />
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
          {["all", ...CONTACT_STATUSES].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                status === s
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={debouncedSearch || status !== "all" ? "No matching contacts" : "No contacts yet"}
          description={
            debouncedSearch || status !== "all"
              ? "Try a different search or clear the filters."
              : "Add your first contact — every deal, task and note can link to them."
          }
          action={{ label: "Add contact", onClick: openCreate }}
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">
            {data?.total ?? items.length} {data?.total === 1 ? "contact" : "contacts"}
            {debouncedSearch ? ` matching “${debouncedSearch}”` : ""}
          </p>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium">Company</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Phone</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium xl:table-cell">Owner</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium xl:table-cell">Added</th>
                  <th scope="col" className="w-12 px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((contact) => (
                  <tr
                    key={contact.id}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <OwnerAvatar name={`${contact.firstName} ${contact.lastName}`} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {contact.firstName} {contact.lastName}
                          </p>
                          {contact.email && <p className="truncate text-xs text-muted-foreground">{contact.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {contact.companyName ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{contact.companyName}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ContactStatusChip status={contact.status} />
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {contact.phone ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                          {contact.phone}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 xl:table-cell">
                      <span className="flex items-center gap-1.5">
                        <OwnerAvatar name={contact.ownerName ?? undefined} size="sm" />
                        <span className="truncate text-muted-foreground">{contact.ownerName ?? "Unassigned"}</span>
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">
                      <DateText iso={contact.createdAt} style="date" timezone={user?.timezone} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${contact.firstName}`}>
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(contact)}>
                            <Pencil className="size-4" aria-hidden="true" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(contact)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {items.map((contact) => (
              <li key={contact.id}>
                <Link
                  href={`/contacts/${contact.id}`}
                  className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <OwnerAvatar name={`${contact.firstName} ${contact.lastName}`} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {contact.companyName ?? contact.email ?? contact.phone ?? "No details yet"}
                        </p>
                      </div>
                    </div>
                    <ContactStatusChip status={contact.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <OwnerAvatar name={contact.ownerName ?? undefined} size="sm" />
                      {contact.ownerName ?? "Unassigned"}
                    </span>
                    <DateText iso={contact.createdAt} style="relative" timezone={user?.timezone} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {(data?.total ?? 0) > items.length && (
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Showing {items.length} of {data?.total}. Narrow your search to find specific people.
              </p>
            </div>
          )}
        </>
      )}

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        companies={companies}
        members={members}
        onSaved={reload}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.firstName} ${deleteTarget?.lastName ?? ""}`.trim() + "?"}
        description="This removes the contact for your whole workspace. Their deals and tasks stay, but unlinked. This cannot be undone."
        confirmLabel="Delete contact"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
