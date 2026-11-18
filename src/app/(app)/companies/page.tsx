"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Building2, Globe, MoreHorizontal, Pencil, Trash2, Plus, Users } from "lucide-react"
import { toast } from "sonner"

import { useApp } from "@/components/app/app-provider"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { Field } from "@/components/shared/field"
import { OwnerAvatar } from "@/components/shared/owner-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
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
import { useApiData } from "@/hooks/use-api-data"
import { api, ApiClientError } from "@/lib/api-client"
import type { Company, WorkspaceMember } from "@/lib/types"

interface FormState {
  id?: string
  name: string
  domain: string
  industry: string
  phone: string
  city: string
  state: string
  country: string
  ownerId: string
}

const EMPTY_FORM: FormState = {
  name: "",
  domain: "",
  industry: "",
  phone: "",
  city: "",
  state: "",
  country: "",
  ownerId: "me",
}

function CompanyDialog({
  open,
  onOpenChange,
  initial,
  members,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: FormState | null
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
      name: form.name.trim(),
      domain: form.domain.trim() || undefined,
      industry: form.industry.trim() || undefined,
      phone: form.phone.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      country: form.country.trim() || undefined,
      ownerId: form.ownerId !== "none" ? form.ownerId : null,
    }
    try {
      if (form.id) {
        await api(`/api/companies/${form.id}`, { method: "PATCH", body: payload })
        toast.success("Company updated")
      } else {
        await api("/api/companies", { method: "POST", body: payload })
        toast.success("Company added")
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save the company. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit company" : "Add a company"}</DialogTitle>
          <DialogDescription>Accounts your contacts work at — keep them clean for reporting later.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field
            label="Company name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Sharma Textiles Pvt Ltd"
            required
            minLength={2}
            autoFocus
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Website / domain" value={form.domain} onChange={(e) => set("domain", e.target.value)} placeholder="sharmatextiles.com" />
            <Field label="Industry" value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Textiles" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 44 4000 1234" />
            <div className="space-y-1.5">
              <label htmlFor="company-owner" className="text-sm font-medium text-foreground">
                Owner (assign to)
              </label>
              <select
                id="company-owner"
                value={form.ownerId}
                onChange={(e) => set("ownerId", e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-ring"
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} {m.role !== "member" ? `(${m.role})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Tirupur" />
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
            <Button type="submit" disabled={saving || form.name.trim().length < 2}>
              {saving ? "Saving…" : form.id ? "Save changes" : "Add company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function CompaniesPage() {
  const { activeWorkspace } = useApp()
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FormState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 320)
    return () => clearTimeout(t)
  }, [search])

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "80", offset: "0" })
    if (debounced) params.set("search", debounced)
    return `/api/companies?${params.toString()}`
  }, [debounced])

  const { data, loading, error, reload } = useApiData<{ items: Company[]; total: number }>(query)
  const { data: teamData } = useApiData<{ members: WorkspaceMember[] }>(dialogOpen ? "/api/team" : null)
  const members = teamData?.members ?? []

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (company: Company) => {
    setEditing({
      id: company.id,
      name: company.name,
      domain: company.domain ?? "",
      industry: company.industry ?? "",
      phone: company.phone ?? "",
      city: company.city ?? "",
      state: company.state ?? "",
      country: company.country ?? "",
      ownerId: company.ownerId ?? "none",
    })
    setDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await api(`/api/companies/${deleteTarget.id}`, { method: "DELETE" })
      toast.success(`${deleteTarget.name} removed`)
      setDeleteTarget(null)
      reload()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete the company")
    }
  }

  const items = data?.items ?? []

  return (
    <div>
      <PageHeader
        title="Companies"
        description={`Organisations in ${activeWorkspace?.name ?? "your workspace"} — link contacts and deals to them.`}
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" /> Add company
          </Button>
        }
      />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search companies…" />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={debounced ? "No matching companies" : "No companies yet"}
          description={
            debounced
              ? "Try a different search."
              : "Add the businesses you sell to. Contacts can then be linked to them."
          }
          action={debounced ? undefined : { label: "Add company", onClick: openCreate }}
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">
            {data?.total ?? items.length} {data?.total === 1 ? "company" : "companies"}
          </p>
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">Company</th>
                  <th scope="col" className="px-4 py-3 font-medium">Location</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Industry</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Phone</th>
                  <th scope="col" className="px-4 py-3 font-medium">People</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium xl:table-cell">Owner</th>
                  <th scope="col" className="w-12 px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((company) => (
                  <tr key={company.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{company.name}</p>
                          {company.domain && (
                            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <Globe className="size-3 shrink-0" aria-hidden="true" /> {company.domain}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[company.city, company.state, company.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{company.industry ?? "—"}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{company.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/contacts?companyId=${company.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                      >
                        <Users className="size-3" aria-hidden="true" />
                        {company.contactCount} {company.contactCount === 1 ? "contact" : "contacts"}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 xl:table-cell">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <OwnerAvatar name={company.ownerName ?? undefined} size="sm" />
                        {company.ownerName ?? "Unassigned"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${company.name}`}>
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(company)}>
                            <Pencil className="size-4" aria-hidden="true" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(company)}
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

          <ul className="space-y-3 md:hidden">
            {items.map((company) => (
              <li key={company.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{company.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {company.industry ?? company.domain ?? "—"}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`Actions for ${company.name}`} onClick={() => openEdit(company)}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <Link href={`/contacts?companyId=${company.id}`} className="hover:text-primary">
                    {company.contactCount} {company.contactCount === 1 ? "contact" : "contacts"}
                  </Link>
                  <span>{[company.city, company.country].filter(Boolean).join(", ") || ""}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <CompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        members={members}
        onSaved={reload}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "company"}?`}
        description="Contacts and deals linked to this company stay in your workspace but lose the company link."
        confirmLabel="Delete company"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
