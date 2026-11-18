"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  CalendarClock,
  KanbanSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"

import { useApp } from "@/components/app/app-provider"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DateText } from "@/components/shared/date-text"
import { EmptyState } from "@/components/shared/empty-state"
import { Field } from "@/components/shared/field"
import { Money, MultiCurrencyTotal } from "@/components/shared/money"
import { OwnerAvatar } from "@/components/shared/owner-avatar"
import { PageHeader } from "@/components/shared/page-header"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApiData } from "@/hooks/use-api-data"
import { api, ApiClientError } from "@/lib/api-client"
import { CURRENCIES, isoToDateInput } from "@/lib/i18n"
import type { Contact, Deal, PipelineStage, WorkspaceMember } from "@/lib/types"

interface DealsResponse {
  items: Deal[]
  total: number
}

interface FormState {
  id?: string
  title: string
  amount: string
  currency: string
  stageId: string
  probability: string
  expectedCloseDate: string
  contactId: string
  companyId: string
  ownerId: string
}

const EMPTY_FORM: FormState = {
  title: "",
  amount: "",
  currency: "",
  stageId: "",
  probability: "50",
  expectedCloseDate: "",
  contactId: "none",
  companyId: "none",
  ownerId: "me",
}

/* ------------------------------ kanban pieces ------------------------------ */

function DealCard({
  deal,
  stages,
  onEdit,
  onDelete,
  onMove,
}: {
  deal: Deal
  stages: PipelineStage[]
  onEdit: () => void
  onDelete: () => void
  onMove: (stageId: string) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id })
  const overdue =
    deal.expectedCloseDate && deal.stageKind === "open" && new Date(deal.expectedCloseDate).getTime() < Date.now()

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid={`deal-card-${deal.id}`}
      className={`group relative cursor-grab touch-none rounded-xl border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${
        isDragging ? "z-50 opacity-60 ring-2 ring-primary/60" : ""
      } ${deal.stageKind === "won" ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30" : ""} ${
        deal.stageKind === "lost" ? "border-rose-200 bg-rose-50/50 dark:border-rose-800/60 dark:bg-rose-950/20" : ""
      }`}
      aria-label={`Deal: ${deal.title}, ${deal.stageName}, amount ${deal.amount} ${deal.currency}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{deal.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
              aria-label={`Actions for ${deal.title}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="size-4" aria-hidden="true" /> Edit deal
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <KanbanSquare className="size-4" aria-hidden="true" /> Move to…
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {stages.map((stage) => (
                  <DropdownMenuItem
                    key={stage.id}
                    disabled={stage.id === deal.stageId}
                    onSelect={() => onMove(stage.id)}
                    className="gap-2"
                  >
                    {stage.kind === "won" ? (
                      <TrendingUp className="size-3.5 text-emerald-600" aria-hidden="true" />
                    ) : stage.kind === "lost" ? (
                      <TrendingDown className="size-3.5 text-rose-500" aria-hidden="true" />
                    ) : (
                      <span className="size-3.5" aria-hidden="true" />
                    )}
                    {stage.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
              <Trash2 className="size-4" aria-hidden="true" /> Delete deal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <Money
          amount={deal.amount}
          currency={deal.currency}
          className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary"
        />
        {deal.stageKind === "open" && (
          <span className="text-[10px] font-medium text-muted-foreground">{deal.probability}%</span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="min-w-0 truncate">
          {deal.contactName ?? deal.companyName ?? "No link"}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <CalendarClock className={`size-3 ${overdue ? "text-rose-500" : ""}`} aria-hidden="true" />
          {deal.expectedCloseDate ? (
            <span className={overdue ? "font-medium text-rose-600 dark:text-rose-400" : ""}>
              <DateText iso={deal.expectedCloseDate} style="date" />
            </span>
          ) : (
            "—"
          )}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 border-t pt-2">
        <OwnerAvatar name={deal.ownerName ?? undefined} size="sm" />
        <span className="truncate text-[11px] text-muted-foreground">{deal.ownerName ?? "Unassigned"}</span>
      </div>
    </div>
  )
}

function StageColumn({
  stage,
  deals,
  children,
}: {
  stage: PipelineStage
  deals: Deal[]
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const values = deals.reduce<Record<string, number>>((acc, d) => {
    acc[d.currency] = (acc[d.currency] ?? 0) + d.amount
    return acc
  }, {})
  const valueEntries = Object.entries(values).map(([currency, amount]) => ({ currency, amount }))

  return (
    <div
      className={`flex min-w-[270px] flex-1 flex-col rounded-xl border bg-muted/35 ${
        isOver ? "border-primary/60 ring-2 ring-primary/30" : ""
      } ${stage.kind === "won" ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""} ${
        stage.kind === "lost" ? "bg-rose-50/40 dark:bg-rose-950/15" : ""
      }`}
    >
      <div
        ref={setNodeRef}
        data-testid={`stage-${stage.name}`}
        className="flex h-full flex-col p-3"
        aria-label={`${stage.name} column with ${deals.length} deals`}
      >
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {stage.name}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              {deals.length}
            </span>
          </p>
          <span className="text-[11px] font-medium text-muted-foreground">
            {valueEntries.length > 0 ? <MultiCurrencyTotal entries={valueEntries} /> : "—"}
          </span>
        </div>
        <div
          className="flex-1 space-y-2.5 overflow-y-auto p-0.5 scrollbar-thin"
          style={{ maxHeight: "calc(100vh - 15rem)" }}
          onDragOver={(e) => e.preventDefault()}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/* --------------------------------- main page -------------------------------- */

function DealsBoard() {
  const searchParams = useSearchParams()
  const presetContactId = searchParams.get("contactId")
  const { user, activeWorkspace } = useApp()

  const dealsQuery = useApiData<DealsResponse>(`/api/deals?limit=200${presetContactId ? `&contactId=${presetContactId}` : ""}`)
  const stagesQuery = useApiData<{ stages: PipelineStage[] }>("/api/stages")
  const teamQuery = useApiData<{ members: WorkspaceMember[] }>("/api/team")
  const contactsQuery = useApiData<{ items: Contact[] }>("/api/contacts?limit=200")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FormState | null>(null)
  const [defaultStage, setDefaultStage] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  const stages = stagesQuery.data?.stages ?? []
  const deals = dealsQuery.data?.items ?? []
  const members = teamQuery.data?.members ?? []
  const contacts = contactsQuery.data?.items ?? []

  const reload = () => {
    dealsQuery.reload()
    stagesQuery.reload()
  }

  const openCreate = (stageId?: string) => {
    setEditing(null)
    setDefaultStage(stageId ?? null)
    setDialogOpen(true)
  }

  const openEdit = (deal: Deal) => {
    setEditing({
      id: deal.id,
      title: deal.title,
      amount: String(deal.amount || ""),
      currency: deal.currency,
      stageId: deal.stageId,
      probability: String(deal.probability ?? 50),
      expectedCloseDate: isoToDateInput(deal.expectedCloseDate) ?? "",
      contactId: deal.contactId ?? "none",
      companyId: deal.companyId ?? "none",
      ownerId: deal.ownerId ?? "none",
    })
    setDialogOpen(true)
  }

  const moveDeal = async (dealId: string, stageId: string) => {
    const deal = deals.find((d) => d.id === dealId)
    if (!deal || deal.stageId === stageId) return
    // optimistic: move the deal locally
    dealsQuery.setData((prev) => {
      if (!prev) return prev
      const stage = stages.find((s) => s.id === stageId)
      return {
        ...prev,
        items: prev.items.map((d) =>
          d.id === dealId
            ? { ...d, stageId, stageName: stage?.name ?? d.stageName, stageKind: stage?.kind ?? d.stageKind }
            : d
        ),
      }
    })
    try {
      await api(`/api/deals/${dealId}`, { method: "PATCH", body: { stageId } })
      const stage = stages.find((s) => s.id === stageId)
      if (stage?.kind === "won") toast.success(`“${deal.title}” moved to Won — well played!`)
      else if (stage?.kind === "lost") toast(`“${deal.title}” moved to Lost`, { description: "Every no teaches something." })
      dealsQuery.reload()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not move the deal")
      dealsQuery.reload()
    }
  }

  const onDragEnd = (event: DragEndEvent) => {
    const dealId = String(event.active.id)
    const stageId = event.over ? String(event.over.id) : null
    if (stageId) void moveDeal(dealId, stageId)
  }

  const confirmDeleteDeal = async () => {
    if (!deleteTarget) return
    try {
      await api(`/api/deals/${deleteTarget.id}`, { method: "DELETE" })
      toast.success("Deal deleted")
      setDeleteTarget(null)
      reload()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete the deal")
    }
  }

  const formInitial: FormState = useMemo(() => {
    if (editing) return editing
    const base: FormState = { ...EMPTY_FORM }
    if (presetContactId) base.contactId = presetContactId
    if (defaultStage) base.stageId = defaultStage
    base.currency = activeWorkspace?.baseCurrency ?? "INR"
    base.ownerId = user?.id ?? "me"
    return base
     
  }, [editing, defaultStage, presetContactId, activeWorkspace?.baseCurrency, user?.id, dialogOpen])

  if (stagesQuery.loading || dealsQuery.loading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-96 min-w-[270px] flex-1 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (stagesQuery.error || dealsQuery.error) {
    return (
      <ErrorState
        message={stagesQuery.error ?? dealsQuery.error ?? "Could not load the pipeline"}
        onRetry={reload}
      />
    )
  }

  return (
    <div>
      <PageHeader
        title="Deal pipeline"
        description={`Drag deals between stages (or use each card's menu on touch screens). Values stay in each deal's own currency.`}
        actions={
          <Button onClick={() => openCreate()}>
            <Plus aria-hidden="true" /> New deal
          </Button>
        }
      />

      {deals.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title="No deals yet"
          description="Create your first deal — give it a name, an amount and a stage. Then drag it forward as talks progress."
          action={{ label: "Create first deal", onClick: () => openCreate() }}
          className="mb-6"
        />
      ) : null}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin md:gap-4">
          {stages.map((stage) => {
            const stageDeals = deals.filter((d) => d.stageId === stage.id)
            return (
              <StageColumn key={stage.id} stage={stage} deals={stageDeals}>
                {stageDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    stages={stages}
                    onEdit={() => openEdit(deal)}
                    onDelete={() => setDeleteTarget(deal)}
                    onMove={(stageId) => void moveDeal(deal.id, stageId)}
                  />
                ))}
              </StageColumn>
            )
          })}
        </div>
      </DndContext>

      <DealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={formInitial}
        stages={stages}
        contacts={contacts}
        members={members}
        saved={reload}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete “${deleteTarget?.title ?? "deal"}”?`}
        description="The deal disappears for your whole workspace. Linked tasks stay but lose the deal link."
        confirmLabel="Delete deal"
        onConfirm={() => void confirmDeleteDeal()}
      />
    </div>
  )
}

/* -------------------------------- deal dialog ------------------------------- */

function DealDialog({
  open,
  onOpenChange,
  initial,
  stages,
  contacts,
  members,
  saved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: FormState
  stages: PipelineStage[]
  contacts: Contact[]
  members: WorkspaceMember[]
  saved: () => void
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastInitial = useRef<FormState>(initial)

  useEffect(() => {
    if (open && lastInitial.current !== initial) {
      setForm(initial)
      lastInitial.current = initial
      setError(null)
    }
  }, [open, initial])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const openStages = stages.filter((s) => s.kind === "open")
  const chosenStage = form.stageId || openStages[0]?.id || stages[0]?.id || ""

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const amount = form.amount ? Number(form.amount) : 0
    if (form.amount && (!Number.isFinite(amount) || amount < 0)) {
      setError("Amount must be a positive number")
      setSaving(false)
      return
    }
    const payload = {
      title: form.title.trim(),
      amount: Math.round(amount * 100) / 100,
      currency: form.currency,
      stageId: chosenStage,
      probability: form.probability ? Math.min(100, Math.max(0, Number(form.probability))) : undefined,
      expectedCloseDate: form.expectedCloseDate || null,
      contactId: form.contactId !== "none" ? form.contactId : null,
      companyId: form.companyId !== "none" ? form.companyId : null,
      ownerId: form.ownerId !== "none" ? form.ownerId : null,
    }
    try {
      if (form.id) {
        await api(`/api/deals/${form.id}`, { method: "PATCH", body: payload })
        toast.success("Deal updated")
      } else {
        await api("/api/deals", { method: "POST", body: payload })
        toast.success("Deal created")
      }
      onOpenChange(false)
      saved()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save the deal. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const companyOptions = useMemo(() => {
    const ids = new Set(contacts.map((c) => c.companyId).filter(Boolean))
    return [...ids].map((id) => {
      const contact = contacts.find((c) => c.companyId === id)
      return { id: id as string, name: contact?.companyName ?? "Company" }
    })
  }, [contacts])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit deal" : "New deal"}</DialogTitle>
          <DialogDescription>
            Amounts keep their own currency — reporting converts them approximately to your workspace currency.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field
            label="Deal title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Bulk order — 500 units"
            required
            minLength={2}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field
              label="Amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="125000"
            />
            <div className="space-y-1.5">
              <label htmlFor="deal-currency" className="text-sm font-medium text-foreground">
                Currency
              </label>
              <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger id="deal-currency" aria-label="Currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol ? `${c.symbol} ` : ""}
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field
              label="Win chance %"
              type="number"
              min="0"
              max="100"
              inputMode="numeric"
              value={form.probability}
              onChange={(e) => set("probability", e.target.value)}
              placeholder="50"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="deal-stage" className="text-sm font-medium text-foreground">
                Stage
              </label>
              <Select value={chosenStage} onValueChange={(v) => set("stageId", v)}>
                <SelectTrigger id="deal-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.kind !== "open" ? ` (${s.kind})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field
              label="Expected close date"
              type="date"
              value={form.expectedCloseDate}
              onChange={(e) => set("expectedCloseDate", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="deal-contact" className="text-sm font-medium text-foreground">
                Contact
              </label>
              <Select value={form.contactId} onValueChange={(v) => set("contactId", v)}>
                <SelectTrigger id="deal-contact">
                  <SelectValue placeholder="No contact" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="none">No contact</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {`${c.firstName} ${c.lastName}`.trim()}
                      {c.companyName ? ` · ${c.companyName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="deal-owner" className="text-sm font-medium text-foreground">
                Owner
              </label>
              <Select value={form.ownerId} onValueChange={(v) => set("ownerId", v)}>
                <SelectTrigger id="deal-owner">
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
              {saving ? "Saving…" : form.id ? "Save changes" : "Create deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function DealsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <DealsBoard />
    </Suspense>
  )
}
