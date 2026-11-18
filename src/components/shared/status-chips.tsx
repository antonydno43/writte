"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ContactStatus, StageKind, TaskPriority } from "@/lib/types"

const CONTACT_STATUS: Record<ContactStatus, string> = {
  lead: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-800",
  contacted:
    "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/50 dark:text-teal-200 dark:border-teal-800",
  qualified:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-800",
  customer:
    "bg-green-100 text-green-900 border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800",
  lost: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/50 dark:text-rose-200 dark:border-rose-800",
}

export function ContactStatusChip({ status }: { status: ContactStatus }) {
  const cls = CONTACT_STATUS[status] ?? CONTACT_STATUS.lead
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", cls)}>
      {status}
    </span>
  )
}

export function StageKindChip({ kind }: { kind: StageKind }) {
  if (kind === "won") {
    return <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">Won</Badge>
  }
  if (kind === "lost") {
    return <Badge variant="destructive">Lost</Badge>
  }
  return <Badge variant="secondary" className="font-normal">Open</Badge>
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  high: "text-rose-600 dark:text-rose-300",
  normal: "text-foreground",
  low: "text-muted-foreground",
}

export function PriorityDot({ priority }: { priority: TaskPriority }) {
  const cls =
    priority === "high"
      ? "bg-rose-500"
      : priority === "normal"
        ? "bg-amber-400"
        : "bg-slate-300 dark:bg-slate-600"
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", cls)} aria-label={`${priority} priority`} />
}
