/**
 * The Backend contract: every operation the CRM needs, implemented twice:
 *   - local.ts    — in-memory store for local development/preview (no env needed)
 *   - supabase.ts — production backend on Supabase Postgres + Auth (+ strict RLS)
 * API routes call getBackend() and never know which one is active.
 */

import { RequestContext } from "@/lib/http"
import type {
  Company,
  CompanyInput,
  Contact,
  ContactDetail,
  ContactInput,
  DashboardData,
  Deal,
  DealInput,
  Invitation,
  InvitationInfo,
  InviteResult,
  Note,
  NoteInput,
  PipelineStage,
  Role,
  Task,
  TaskInput,
  UserProfile,
  WorkspaceMember,
  WorkspaceSummary,
  WorkspaceInput,
} from "@/lib/types"

export type Ctx = RequestContext

export interface ContactQuery {
  search?: string
  status?: string
  ownerId?: string
  companyId?: string
  limit: number
  offset: number
}

export interface CompanyQuery {
  search?: string
  limit: number
  offset: number
}

export interface DealQuery {
  search?: string
  contactId?: string
  limit: number
  offset: number
}

export interface TaskQuery {
  status?: string
  assigneeId?: string
  contactId?: string
  dealId?: string
  limit: number
  offset: number
}

export interface Backend {
  readonly mode: "local" | "supabase"

  auth: {
    signup(ctx: Ctx, input: {
      name: string
      email: string
      password: string
      timezone: string
      currency: string
    }): Promise<{ user: UserProfile; needsVerification: boolean }>
    login(ctx: Ctx, email: string, password: string): Promise<UserProfile>
    logout(ctx: Ctx): Promise<void>
    currentUser(ctx: Ctx): Promise<UserProfile | null>
    updateProfile(ctx: Ctx, input: {
      name?: string
      timezone?: string
      currency?: string
    }): Promise<UserProfile>
    changePassword(ctx: Ctx, currentPassword: string, newPassword: string): Promise<void>
  }

  workspaces: {
    create(ctx: Ctx, input: WorkspaceInput): Promise<WorkspaceSummary>
    list(ctx: Ctx): Promise<WorkspaceSummary[]>
    /** Active workspace from cookie, validated against membership. */
    getActive(ctx: Ctx): Promise<WorkspaceSummary | null>
    /** Set the active workspace cookie after verifying membership. */
    switch(ctx: Ctx, workspaceId: string): Promise<WorkspaceSummary>
    update(ctx: Ctx, input: { name?: string; baseCurrency?: string; timezone?: string }): Promise<WorkspaceSummary>
  }

  stages: {
    list(ctx: Ctx): Promise<PipelineStage[]>
    /**
     * Replace the full stage list. Stages carrying an `id` keep it (rename /
     * reorder / kind change); stages without an `id` are created. Stages that
     * disappear while holding deals are rejected.
     */
    replace(
      ctx: Ctx,
      stages: { id?: string; name: string; kind: "open" | "won" | "lost" }[]
    ): Promise<PipelineStage[]>
  }

  contacts: {
    list(ctx: Ctx, query: ContactQuery): Promise<{ items: Contact[]; total: number }>
    get(ctx: Ctx, id: string): Promise<ContactDetail>
    create(ctx: Ctx, input: ContactInput): Promise<Contact>
    update(ctx: Ctx, id: string, input: Partial<ContactInput>): Promise<Contact>
    delete(ctx: Ctx, id: string): Promise<void>
  }

  companies: {
    list(ctx: Ctx, query: CompanyQuery): Promise<{ items: Company[]; total: number }>
    create(ctx: Ctx, input: CompanyInput): Promise<Company>
    update(ctx: Ctx, id: string, input: Partial<CompanyInput>): Promise<Company>
    delete(ctx: Ctx, id: string): Promise<void>
  }

  deals: {
    list(ctx: Ctx, query: DealQuery): Promise<{ items: Deal[]; total: number }>
    create(ctx: Ctx, input: DealInput): Promise<Deal>
    update(ctx: Ctx, id: string, input: Partial<DealInput>): Promise<Deal>
    delete(ctx: Ctx, id: string): Promise<void>
  }

  tasks: {
    list(ctx: Ctx, query: TaskQuery): Promise<{ items: Task[]; total: number }>
    create(ctx: Ctx, input: TaskInput): Promise<Task>
    update(ctx: Ctx, id: string, input: Partial<TaskInput> & { status?: "open" | "done" }): Promise<Task>
    delete(ctx: Ctx, id: string): Promise<void>
  }

  notes: {
    list(ctx: Ctx, entityType: "contact" | "deal", entityId: string): Promise<Note[]>
    create(ctx: Ctx, input: NoteInput): Promise<Note>
    delete(ctx: Ctx, id: string): Promise<void>
  }

  dashboard(ctx: Ctx): Promise<DashboardData>

  team: {
    list(ctx: Ctx): Promise<{ members: WorkspaceMember[]; invitations: Invitation[] }>
    invite(ctx: Ctx, email: string, role: Role): Promise<InviteResult>
    revoke(ctx: Ctx, invitationId: string): Promise<void>
    resend(ctx: Ctx, invitationId: string): Promise<InviteResult>
    setMemberRole(ctx: Ctx, memberId: string, role: Role): Promise<void>
    removeMember(ctx: Ctx, memberId: string): Promise<void>
  }

  invitations: {
    info(ctx: Ctx, token: string): Promise<InvitationInfo | null>
    accept(ctx: Ctx, token: string): Promise<WorkspaceSummary>
  }
}

/** Default pipeline stages seeded for every new workspace. */
export const DEFAULT_STAGES: { name: string; kind: "open" | "won" | "lost" }[] = [
  { name: "New lead", kind: "open" },
  { name: "Qualified", kind: "open" },
  { name: "Proposal sent", kind: "open" },
  { name: "Negotiation", kind: "open" },
  { name: "Won", kind: "won" },
  { name: "Lost", kind: "lost" },
]

export const INVITE_EXPIRY_DAYS = 7
