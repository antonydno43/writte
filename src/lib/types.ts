/** Shared domain types for YourBiz CRM — used by backends, API routes and UI. */

export type Role = "owner" | "admin" | "member"

export const CONTACT_STATUSES = ["lead", "contacted", "qualified", "customer", "lost"] as const
export type ContactStatus = (typeof CONTACT_STATUSES)[number]

export const TASK_PRIORITIES = ["low", "normal", "high"] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export type TaskStatus = "open" | "done"

export type StageKind = "open" | "won" | "lost"

export type NoteEntityType = "contact" | "deal"

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired"

export interface UserProfile {
  id: string
  email: string
  name: string
  timezone: string
  /** User's preferred display currency (personal preference) */
  currency: string
  createdAt: string
}

export interface WorkspaceSummary {
  id: string
  name: string
  baseCurrency: string
  timezone: string
  role: Role
  createdAt: string
}

export interface WorkspaceMember {
  id: string
  userId: string
  name: string
  email: string
  role: Role
  joinedAt: string
}

export interface Invitation {
  id: string
  email: string
  role: Role
  status: InvitationStatus
  createdAt: string
  expiresAt: string
  invitedBy: string
}

export interface Company {
  id: string
  name: string
  domain: string | null
  industry: string | null
  phone: string | null
  city: string | null
  state: string | null
  country: string | null
  ownerId: string | null
  ownerName: string | null
  createdAt: string
  contactCount: number
}

export interface Contact {
  id: string
  workspaceId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  jobTitle: string | null
  status: ContactStatus
  companyId: string | null
  companyName: string | null
  ownerId: string | null
  ownerName: string | null
  city: string | null
  state: string | null
  country: string | null
  createdAt: string
  updatedAt: string
}

export interface Deal {
  id: string
  workspaceId: string
  title: string
  amount: number
  currency: string
  stageId: string
  stageName: string
  stageKind: StageKind
  probability: number
  expectedCloseDate: string | null
  closedAt: string | null
  contactId: string | null
  contactName: string | null
  companyId: string | null
  companyName: string | null
  ownerId: string | null
  ownerName: string | null
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  workspaceId: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  dueAt: string | null
  assigneeId: string | null
  assigneeName: string | null
  contactId: string | null
  contactName: string | null
  dealId: string | null
  dealTitle: string | null
  createdByName: string | null
  createdAt: string
  completedAt: string | null
}

export interface Note {
  id: string
  workspaceId: string
  entityType: NoteEntityType
  entityId: string
  body: string
  authorId: string
  authorName: string
  createdAt: string
}

export interface PipelineStage {
  id: string
  name: string
  position: number
  kind: StageKind
}

export interface MoneyByCurrency {
  currency: string
  amount: number
}

export interface ActivityItem {
  type: "contact" | "deal" | "task" | "note" | "member"
  id: string
  title: string
  subtitle: string | null
  at: string
}

export interface DashboardData {
  baseCurrency: string
  openPipeline: MoneyByCurrency[]
  approxOpenPipelineBase: number
  wonThisMonth: MoneyByCurrency[]
  approxWonBase: number
  counts: {
    contacts: number
    newContacts7d: number
    openDeals: number
    openTasks: number
    overdueTasks: number
    members: number
  }
  stages: {
    id: string
    name: string
    kind: StageKind
    count: number
    value: MoneyByCurrency[]
  }[]
  wonTrend: {
    label: string
    value: number
  }[]
  upcomingTasks: Task[]
  activity: ActivityItem[]
}

export interface ContactDetail extends Contact {
  company: Company | null
  deals: Deal[]
  tasks: Task[]
  notes: Note[]
}

/* ---------- API payload input types (snake_case avoided; plain camelCase) ---------- */

export interface SignupInput {
  name: string
  email: string
  password: string
  timezone?: string
  currency?: string
}

export interface WorkspaceInput {
  name: string
  baseCurrency?: string
  timezone?: string
}

export interface ContactInput {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  jobTitle?: string
  status?: ContactStatus
  companyId?: string | null
  ownerId?: string | null
  city?: string
  state?: string
  country?: string
}

export interface CompanyInput {
  name: string
  domain?: string
  industry?: string
  phone?: string
  city?: string
  state?: string
  country?: string
  ownerId?: string | null
}

export interface DealInput {
  title: string
  amount?: number
  currency?: string
  stageId?: string
  probability?: number
  expectedCloseDate?: string | null
  contactId?: string | null
  companyId?: string | null
  ownerId?: string | null
}

export interface TaskInput {
  title: string
  description?: string
  priority?: TaskPriority
  dueAt?: string | null
  assigneeId?: string | null
  contactId?: string | null
  dealId?: string | null
}

export interface NoteInput {
  entityType: NoteEntityType
  entityId: string
  body: string
}

export interface InviteResult {
  invitation: Invitation
  emailSent: boolean
  /** Present when the email could not be sent (no Resend key) — for dev fallback UI */
  inviteUrl: string
}

export interface InvitationInfo {
  workspaceName: string
  workspaceId: string
  inviterName: string
  email: string
  role: Role
  status: InvitationStatus
  expiresAt: string
}
