"use client"

import { useState } from "react"
import { Copy, Crown, Mail, MoreHorizontal, RotateCcw, ShieldCheck, UserPlus, UsersRound, XCircle } from "lucide-react"
import { toast } from "sonner"

import { useApp } from "@/components/app/app-provider"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DateText } from "@/components/shared/date-text"
import { EmptyState } from "@/components/shared/empty-state"
import { Field } from "@/components/shared/field"
import { OwnerAvatar } from "@/components/shared/owner-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { ErrorState, TableSkeleton } from "@/components/shared/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApiData } from "@/hooks/use-api-data"
import { api, ApiClientError } from "@/lib/api-client"
import type { Invitation, InviteResult, Role, WorkspaceMember } from "@/lib/types"

const ROLE_BADGE: Record<Role, string> = {
  owner: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  admin: "border-teal-300 bg-teal-100 text-teal-900 dark:border-teal-800 dark:bg-teal-900/50 dark:text-teal-200",
  member: "border-border bg-muted text-muted-foreground",
}

function RoleChip({ role }: { role: Role }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${ROLE_BADGE[role]}`}>
      {role === "owner" ? <Crown className="size-3" aria-hidden="true" /> : null}
      {role}
    </span>
  )
}

function InviteDialog({
  open,
  onOpenChange,
  canAdmin,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  canAdmin: boolean
  onSaved: () => void
}) {
  const { activeWorkspace, refresh } = useApp()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "member">("member")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<InviteResult | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await api<InviteResult>("/api/team/invite", {
        method: "POST",
        body: { email: email.trim().toLowerCase(), role },
      })
      setResult(res)
      if (res.emailSent) {
        toast.success(`Invitation emailed to ${email}`)
      } else {
        toast.info(`Invitation created — email not configured, link below`)
      }
      await refresh()
      onSaved()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not send the invitation. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const close = (next: boolean) => {
    if (!next) {
      setResult(null)
      setEmail("")
      setRole("member")
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{result ? "Invitation ready" : `Invite someone to ${activeWorkspace?.name ?? "your workspace"}`}</DialogTitle>
          <DialogDescription>
            {result
              ? result.emailSent
                ? "We emailed them a friendly invitation. They can accept whether or not they have a YourBiz account."
                : "Email sending is not configured on this server yet, so share this secure link yourself — it expires in 7 days."
              : canAdmin
                ? "They'll get an email with a one-click join link. People without an account can create one on the way in."
                : "Only owners and admins can invite."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            {!result.emailSent && (
              <div className="rounded-xl border bg-muted/40 p-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Invite link for {result.invitation.email}:</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-background px-3 py-2 text-xs">{result.inviteUrl}</code>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Copy invite link"
                    onClick={() => {
                      void navigator.clipboard.writeText(result.inviteUrl).then(() => toast.success("Link copied"))
                    }}
                  >
                    <Copy className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              {result.emailSent
                ? "You can revoke the invitation any time from this page."
                : "Tip: set RESEND_API_KEY on your server to email invitations automatically."}
            </div>
            <Button className="w-full" onClick={() => close(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@yourcompany.com"
              required
              autoFocus
            />
            <div className="space-y-1.5">
              <label htmlFor="invite-role" className="text-sm font-medium text-foreground">
                Role
              </label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
                <SelectTrigger id="invite-role" aria-label="Role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member — full access to CRM data</SelectItem>
                  <SelectItem value="admin">Admin — also manages team & settings</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Members see and edit contacts, deals and tasks. Admins can additionally invite people, change roles
                and update workspace settings. Owners are fixed (that&apos;s you).
              </p>
            </div>
            {error && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !email.includes("@")}>
                {saving ? "Inviting…" : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function TeamPage() {
  const { activeWorkspace, refresh, mode } = useApp()
  const { data, loading, error, reload } = useApiData<{ members: WorkspaceMember[]; invitations: Invitation[] }>(
    "/api/team"
  )
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<WorkspaceMember | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const members = data?.members ?? []
  const invitations = data?.invitations ?? []
  const myRole = activeWorkspace?.role
  const canAdmin = myRole === "owner" || myRole === "admin"

  const setRole = async (member: WorkspaceMember, role: Role) => {
    setBusy(member.id)
    try {
      await api(`/api/team/members/${member.id}`, { method: "PATCH", body: { role } })
      toast.success(`${member.name} is now a ${role}`)
      reload()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not change the role")
    } finally {
      setBusy(null)
    }
  }

  const removeMember = async () => {
    if (!removeTarget) return
    setBusy(removeTarget.id)
    try {
      await api(`/api/team/members/${removeTarget.id}`, { method: "DELETE" })
      toast.success(`${removeTarget.name} removed from the workspace`)
      setRemoveTarget(null)
      await refresh()
      reload()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not remove the member")
    } finally {
      setBusy(null)
    }
  }

  const invitationAction = async (invitation: Invitation, action: "resend" | "revoke") => {
    setBusy(invitation.id)
    try {
      const res = await api<InviteResult | { ok: boolean }>(`/api/team/invitations/${invitation.id}`, {
        method: "POST",
        body: { action },
      })
      if ("emailSent" in res) {
        if (res.emailSent) toast.success(`A new invitation was emailed to ${invitation.email}`)
        else
          toast.info("Email not configured — share the new link from the invite dialog", {
            description: res.inviteUrl,
          })
      } else {
        toast.success("Invitation revoked")
      }
      reload()
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not update the invitation")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Team & invitations"
        description={`People with access to ${activeWorkspace?.name ?? "this workspace"}. Every workspace you own or join keeps separate data.`}
        actions={
          canAdmin && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus aria-hidden="true" /> Invite member
            </Button>
          )
        }
      />

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UsersRound className="size-4 text-primary" aria-hidden="true" /> Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y">
                {members.map((member) => (
                  <li key={member.id} className="flex items-center gap-3 px-6 py-3">
                    <OwnerAvatar name={member.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {member.name}
                        <span className="ml-2 align-middle">
                          <RoleChip role={member.role} />
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.email} · joined <DateText iso={member.joinedAt} style="date" />
                      </p>
                    </div>
                    {canAdmin && member.role !== "owner" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Manage ${member.name}`} disabled={busy === member.id}>
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Change role</DropdownMenuLabel>
                          {member.role !== "member" && (
                            <DropdownMenuItem onSelect={() => void setRole(member, "member")}>
                              <UsersRound className="size-4" aria-hidden="true" /> Member
                            </DropdownMenuItem>
                          )}
                          {member.role !== "admin" && (
                            <DropdownMenuItem onSelect={() => void setRole(member, "admin")}>
                              <ShieldCheck className="size-4" aria-hidden="true" /> Admin
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setRemoveTarget(member)}
                          >
                            <XCircle className="size-4" aria-hidden="true" /> Remove from workspace
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="size-4 text-primary" aria-hidden="true" /> Invitations ({invitations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {invitations.length === 0 ? (
                <div className="px-6 pb-6">
                  <EmptyState
                    icon={Mail}
                    title="No invitations yet"
                    description={
                      canAdmin
                        ? "Invite teammates by email — they'll get a friendly link to join, even without an account."
                        : "Owners and admins can invite people by email."
                    }
                    className="border-0 bg-transparent"
                    action={canAdmin ? { label: "Invite member", onClick: () => setInviteOpen(true) } : undefined}
                  />
                </div>
              ) : (
                <ul className="divide-y">
                  {invitations.map((invitation) => (
                    <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                      <OwnerAvatar name={invitation.email} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{invitation.email}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          Invited by {invitation.invitedBy} · <DateText iso={invitation.createdAt} style="relative" />
                          {invitation.status === "pending" && (
                            <> · expires <DateText iso={invitation.expiresAt} style="date" /></>
                          )}
                        </p>
                      </div>
                      <RoleChip role={invitation.role} />
                      <Badge
                        variant={
                          invitation.status === "accepted"
                            ? "default"
                            : invitation.status === "pending"
                              ? "secondary"
                              : "outline"
                        }
                        className={
                          invitation.status === "accepted"
                            ? "bg-emerald-600 text-white"
                            : invitation.status === "pending"
                              ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                              : ""
                        }
                      >
                        {invitation.status}
                      </Badge>
                      {canAdmin && invitation.status === "pending" && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground"
                            aria-label={`Resend invitation to ${invitation.email}`}
                            disabled={busy === invitation.id}
                            onClick={() => void invitationAction(invitation, "resend")}
                          >
                            <RotateCcw className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Revoke invitation to ${invitation.email}`}
                            disabled={busy === invitation.id}
                            onClick={() => void invitationAction(invitation, "revoke")}
                          >
                            <XCircle className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {mode === "local" && invitations.length > 0 && (
                <p className="px-6 pt-3 text-[11px] text-muted-foreground">
                  Preview mode note: without RESEND_API_KEY the invite link is shown to you instead of being emailed.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} canAdmin={canAdmin} onSaved={reload} />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove ${removeTarget?.name ?? "member"}?`}
        description="They immediately lose access to this workspace. Their own workspaces are unaffected. They can be re-invited later."
        confirmLabel="Remove member"
        onConfirm={() => void removeMember()}
      />
    </div>
  )
}
