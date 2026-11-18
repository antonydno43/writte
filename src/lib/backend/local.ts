/**
 * LOCAL backend — in-memory implementation with JSON file persistence
 * (db/dev-store.json) so the dev preview keeps data across restarts.
 * Used when Supabase env vars are not configured. Starts EMPTY — no seed data.
 */

import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

import { errors } from "@/lib/http"
import { sendInvitationEmail, sendWelcomeEmail } from "@/lib/email"
import { convertApprox, isValidCurrency, isValidTimezone } from "@/lib/i18n"
import type {
  ActivityItem,
  Company,
  CompanyInput,
  Contact,
  ContactDetail,
  ContactInput,
  ContactStatus,
  DashboardData,
  Deal,
  DealInput,
  Invitation,
  InvitationInfo,
  InviteResult,
  MoneyByCurrency,
  Note,
  NoteInput,
  PipelineStage,
  Role,
  Task,
  TaskInput,
  UserProfile,
  WorkspaceMember,
  WorkspaceSummary,
} from "@/lib/types"
import { type Backend, type Ctx, DEFAULT_STAGES, INVITE_EXPIRY_DAYS } from "./contract"

const STORE_FILE = path.join(process.cwd(), "db", "dev-store.json")
const SESSION_COOKIE = "yb_session"
const WS_COOKIE = "yb_ws"
const SESSION_SECRET = process.env.SESSION_SECRET || "yourbiz-dev-secret-change-me"
const SESSION_DAYS = 30

/* --------------------------------- rows ---------------------------------- */

interface UserRow {
  id: string
  email: string
  name: string
  timezone: string
  currency: string
  hash: string
  salt: string
  createdAt: string
}

interface WorkspaceRow {
  id: string
  name: string
  baseCurrency: string
  timezone: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface MembershipRow {
  id: string
  workspaceId: string
  userId: string
  role: Role
  joinedAt: string
}

interface InvitationRow {
  id: string
  workspaceId: string
  email: string
  role: Role
  token: string
  status: "pending" | "accepted" | "revoked" | "expired"
  invitedBy: string
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
}

interface StageRow {
  id: string
  workspaceId: string
  name: string
  position: number
  kind: "open" | "won" | "lost"
}

interface CompanyRow {
  id: string
  workspaceId: string
  name: string
  domain: string | null
  industry: string | null
  phone: string | null
  city: string | null
  state: string | null
  country: string | null
  ownerId: string | null
  createdAt: string
  updatedAt: string
}

interface ContactRow {
  id: string
  workspaceId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  jobTitle: string | null
  status: ContactStatus
  companyId: string | null
  ownerId: string | null
  city: string | null
  state: string | null
  country: string | null
  createdAt: string
  updatedAt: string
}

interface DealRow {
  id: string
  workspaceId: string
  title: string
  amount: number
  currency: string
  stageId: string
  probability: number
  expectedCloseDate: string | null
  closedAt: string | null
  contactId: string | null
  companyId: string | null
  ownerId: string | null
  createdAt: string
  updatedAt: string
}

interface TaskRow {
  id: string
  workspaceId: string
  title: string
  description: string | null
  status: "open" | "done"
  priority: "low" | "normal" | "high"
  dueAt: string | null
  assigneeId: string | null
  contactId: string | null
  dealId: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

interface NoteRow {
  id: string
  workspaceId: string
  entityType: "contact" | "deal"
  entityId: string
  body: string
  authorId: string
  createdAt: string
}

interface Store {
  users: Map<string, UserRow>
  workspaces: Map<string, WorkspaceRow>
  memberships: Map<string, MembershipRow>
  invitations: Map<string, InvitationRow>
  stages: Map<string, StageRow>
  companies: Map<string, CompanyRow>
  contacts: Map<string, ContactRow>
  deals: Map<string, DealRow>
  tasks: Map<string, TaskRow>
  notes: Map<string, NoteRow>
}

/* ------------------------------ store setup ------------------------------ */

const g = globalThis as unknown as { __ybLocalStore?: Promise<Store> }

async function getStore(): Promise<Store> {
  if (!g.__ybLocalStore) {
    g.__ybLocalStore = (async () => {
      const store: Store = {
        users: new Map(),
        workspaces: new Map(),
        memberships: new Map(),
        invitations: new Map(),
        stages: new Map(),
        companies: new Map(),
        contacts: new Map(),
        deals: new Map(),
        tasks: new Map(),
        notes: new Map(),
      }
      try {
        const raw = await fs.readFile(STORE_FILE, "utf8")
        const data = JSON.parse(raw) as Record<string, unknown[]>
        for (const key of Object.keys(store) as (keyof Store)[]) {
          const rows = (data[key] as (typeof store)[keyof Store][] | undefined) ?? []
          for (const row of rows) {
            const id = (row as { id?: string }).id
            if (id) (store[key] as Map<string, unknown>).set(id, row)
          }
        }
        console.log(`[local-backend] loaded ${store.users.size} users, ${store.workspaces.size} workspaces from ${STORE_FILE}`)
      } catch {
        /* first run — start empty */
      }
      return store
    })()
  }
  return g.__ybLocalStore
}

async function persist(store: Store): Promise<void> {
  try {
    const data: Record<string, unknown[]> = {}
    for (const key of Object.keys(store) as (keyof Store)[]) {
      data[key] = [...(store[key] as Map<string, unknown>).values()]
    }
    await fs.mkdir(path.dirname(STORE_FILE), { recursive: true })
    await fs.writeFile(STORE_FILE, JSON.stringify(data), "utf8")
  } catch (err) {
    console.warn("[local-backend] persist failed:", err)
  }
}

/* -------------------------------- helpers --------------------------------- */

const uid = (): string => crypto.randomUUID()
const now = (): string => new Date().toISOString()

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return { hash, salt }
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, "hex")
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}

function sign(value: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url")
}

function makeSessionToken(userId: string): string {
  const payload = `${userId}|${Date.now() + SESSION_DAYS * 86400_000}`
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`
}

function parseSessionToken(token: string | undefined): string | null {
  if (!token) return null
  const [encoded, sig] = token.split(".")
  if (!encoded || !sig) return null
  const payload = Buffer.from(encoded, "base64url").toString()
  if (sign(payload) !== sig) return null
  const [userId, exp] = payload.split("|")
  if (!userId || !exp || Number(exp) < Date.now()) return null
  return userId
}

async function requireUser(ctx: Ctx): Promise<UserRow> {
  const userId = parseSessionToken(ctx.cookies.get(SESSION_COOKIE))
  const store = await getStore()
  const user = userId ? store.users.get(userId) : undefined
  if (!user) throw errors.unauthorized()
  return user
}

async function activeMembership(ctx: Ctx): Promise<{ store: Store; user: UserRow; ws: WorkspaceRow; role: Role }> {
  const user = await requireUser(ctx)
  const store = await getStore()
  const wsId = ctx.cookies.get(WS_COOKIE)
  const ws = wsId ? store.workspaces.get(wsId) : undefined
  const membership = ws
    ? [...store.memberships.values()].find((m) => m.workspaceId === ws.id && m.userId === user.id)
    : undefined
  if (!ws || !membership) {
    throw errors.badRequest("No active workspace. Create or switch to a workspace first.")
  }
  return { store, user, ws, role: membership.role }
}

function requireAdmin(role: Role): void {
  if (role !== "owner" && role !== "admin") {
    throw errors.forbidden("Only workspace owners and admins can do that")
  }
}

function userName(store: Store, id: string | null): string | null {
  return id ? (store.users.get(id)?.name ?? null) : null
}

function companyName(store: Store, id: string | null): string | null {
  return id ? (store.companies.get(id)?.name ?? null) : null
}

function contactName(store: Store, id: string | null): string | null {
  if (!id) return null
  const c = store.contacts.get(id)
  return c ? `${c.firstName} ${c.lastName}`.trim() : null
}

function toUserProfile(u: UserRow): UserProfile {
  return { id: u.id, email: u.email, name: u.name, timezone: u.timezone, currency: u.currency, createdAt: u.createdAt }
}

function toWorkspaceSummary(store: Store, ws: WorkspaceRow, userId: string): WorkspaceSummary {
  const role = [...store.memberships.values()].find((m) => m.workspaceId === ws.id && m.userId === userId)?.role ?? "member"
  return { id: ws.id, name: ws.name, baseCurrency: ws.baseCurrency, timezone: ws.timezone, role, createdAt: ws.createdAt }
}

function toContact(store: Store, c: ContactRow): Contact {
  return {
    id: c.id,
    workspaceId: c.workspaceId,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    jobTitle: c.jobTitle,
    status: c.status,
    companyId: c.companyId,
    companyName: companyName(store, c.companyId),
    ownerId: c.ownerId,
    ownerName: userName(store, c.ownerId),
    city: c.city,
    state: c.state,
    country: c.country,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

function toDeal(store: Store, d: DealRow): Deal {
  const stage = store.stages.get(d.stageId)
  return {
    id: d.id,
    workspaceId: d.workspaceId,
    title: d.title,
    amount: d.amount,
    currency: d.currency,
    stageId: d.stageId,
    stageName: stage?.name ?? "Unknown",
    stageKind: stage?.kind ?? "open",
    probability: d.probability,
    expectedCloseDate: d.expectedCloseDate,
    closedAt: d.closedAt,
    contactId: d.contactId,
    contactName: contactName(store, d.contactId),
    companyId: d.companyId,
    companyName: companyName(store, d.companyId),
    ownerId: d.ownerId,
    ownerName: userName(store, d.ownerId),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

function toTask(store: Store, t: TaskRow): Task {
  return {
    id: t.id,
    workspaceId: t.workspaceId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt,
    assigneeId: t.assigneeId,
    assigneeName: userName(store, t.assigneeId),
    contactId: t.contactId,
    contactName: contactName(store, t.contactId),
    dealId: t.dealId,
    dealTitle: t.dealId ? (store.deals.get(t.dealId)?.title ?? null) : null,
    createdByName: userName(store, t.createdBy),
    createdAt: t.createdAt,
    completedAt: t.completedAt,
  }
}

function toNote(store: Store, n: NoteRow): Note {
  return {
    id: n.id,
    workspaceId: n.workspaceId,
    entityType: n.entityType,
    entityId: n.entityId,
    body: n.body,
    authorId: n.authorId,
    authorName: userName(store, n.authorId) ?? "Unknown",
    createdAt: n.createdAt,
  }
}

function toCompany(store: Store, c: CompanyRow): Company {
  const contactCount = [...store.contacts.values()].filter((ct) => ct.companyId === c.id).length
  return {
    id: c.id,
    name: c.name,
    domain: c.domain,
    industry: c.industry,
    phone: c.phone,
    city: c.city,
    state: c.state,
    country: c.country,
    ownerId: c.ownerId,
    ownerName: userName(store, c.ownerId),
    createdAt: c.createdAt,
    contactCount,
  }
}

function toInvitation(row: InvitationRow, store: Store): Invitation {
  void store
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status === "pending" && new Date(row.expiresAt).getTime() < Date.now() ? "expired" : row.status,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    invitedBy: row.invitedBy,
  }
}

function markExpiredPending(rows: InvitationRow[]): void {
  for (const row of rows) {
    if (row.status === "pending" && new Date(row.expiresAt).getTime() < Date.now()) row.status = "expired"
  }
}

/* =============================== the backend ============================== */

export const localBackend: Backend = {
  mode: "local",

  auth: {
    async signup(ctx, input) {
      const store = await getStore()
      const email = input.email.toLowerCase()
      if ([...store.users.values()].some((u) => u.email === email)) {
        throw errors.conflict("An account with this email already exists. Try signing in instead.")
      }
      const { hash, salt } = hashPassword(input.password)
      const user: UserRow = {
        id: uid(),
        email,
        name: input.name,
        timezone: input.timezone,
        currency: input.currency,
        hash,
        salt,
        createdAt: now(),
      }
      store.users.set(user.id, user)
      await persist(store)
      ctx.cookies.set(SESSION_COOKIE, makeSessionToken(user.id), { maxAge: SESSION_DAYS * 86400 })
      void sendWelcomeEmail(email, input.name, ctx.appUrl).catch(() => undefined)
      return { user: toUserProfile(user), needsVerification: false }
    },

    async login(ctx, email, password) {
      const store = await getStore()
      const user = [...store.users.values()].find((u) => u.email === email.toLowerCase())
      if (!user || !verifyPassword(password, user.salt, user.hash)) {
        throw errors.unauthorized("Incorrect email or password")
      }
      ctx.cookies.set(SESSION_COOKIE, makeSessionToken(user.id), { maxAge: SESSION_DAYS * 86400 })
      return toUserProfile(user)
    },

    async logout(ctx) {
      ctx.cookies.delete(SESSION_COOKIE)
      ctx.cookies.delete(WS_COOKIE)
    },

    async currentUser(ctx) {
      try {
        const user = await requireUser(ctx)
        return toUserProfile(user)
      } catch {
        return null
      }
    },

    async updateProfile(ctx, input) {
      const user = await requireUser(ctx)
      const store = await getStore()
      if (input.name !== undefined) user.name = input.name
      if (input.timezone !== undefined) {
        if (!isValidTimezone(input.timezone)) throw errors.badRequest("Unknown timezone")
        user.timezone = input.timezone
      }
      if (input.currency !== undefined) {
        if (!isValidCurrency(input.currency)) throw errors.badRequest("Unknown currency")
        user.currency = input.currency
      }
      await persist(store)
      return toUserProfile(user)
    },

    async changePassword(ctx, currentPassword, newPassword) {
      const user = await requireUser(ctx)
      const store = await getStore()
      if (!verifyPassword(currentPassword, user.salt, user.hash)) {
        throw errors.badRequest("Current password is incorrect")
      }
      const { hash, salt } = hashPassword(newPassword)
      user.hash = hash
      user.salt = salt
      await persist(store)
    },
  },

  workspaces: {
    async create(ctx, input) {
      const user = await requireUser(ctx)
      const store = await getStore()
      const baseCurrency = input.baseCurrency && isValidCurrency(input.baseCurrency) ? input.baseCurrency : "INR"
      const timezone = input.timezone && isValidTimezone(input.timezone) ? input.timezone : "UTC"
      const ws: WorkspaceRow = {
        id: uid(),
        name: input.name,
        baseCurrency,
        timezone,
        createdBy: user.id,
        createdAt: now(),
        updatedAt: now(),
      }
      store.workspaces.set(ws.id, ws)
      store.memberships.set(uid(), { id: uid(), workspaceId: ws.id, userId: user.id, role: "owner", joinedAt: now() })
      DEFAULT_STAGES.forEach((stage, index) => {
        const stageRow: StageRow = {
          id: uid(),
          workspaceId: ws.id,
          name: stage.name,
          position: index,
          kind: stage.kind,
        }
        store.stages.set(stageRow.id, stageRow)
      })
      await persist(store)
      ctx.cookies.set(WS_COOKIE, ws.id, { maxAge: SESSION_DAYS * 86400 })
      return toWorkspaceSummary(store, ws, user.id)
    },

    async list(ctx) {
      const user = await requireUser(ctx)
      const store = await getStore()
      return [...store.workspaces.values()]
        .filter((ws) => [...store.memberships.values()].some((m) => m.workspaceId === ws.id && m.userId === user.id))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((ws) => toWorkspaceSummary(store, ws, user.id))
    },

    async getActive(ctx) {
      try {
        const { store, user, ws } = await activeMembership(ctx)
        return toWorkspaceSummary(store, ws, user.id)
      } catch {
        return null
      }
    },

    async switch(ctx, workspaceId) {
      const user = await requireUser(ctx)
      const store = await getStore()
      const ws = store.workspaces.get(workspaceId)
      const membership = ws && [...store.memberships.values()].find((m) => m.workspaceId === ws.id && m.userId === user.id)
      if (!ws || !membership) throw errors.notFound("Workspace not found or you are not a member of it")
      ctx.cookies.set(WS_COOKIE, ws.id, { maxAge: SESSION_DAYS * 86400 })
      return toWorkspaceSummary(store, ws, user.id)
    },

    async update(ctx, input) {
      const { store, ws, role } = await activeMembership(ctx)
      if (input.name !== undefined) ws.name = input.name
      if (input.baseCurrency !== undefined) {
        if (!isValidCurrency(input.baseCurrency)) throw errors.badRequest("Unknown currency")
        ws.baseCurrency = input.baseCurrency
      }
      if (input.timezone !== undefined) {
        if (!isValidTimezone(input.timezone)) throw errors.badRequest("Unknown timezone")
        ws.timezone = input.timezone
      }
      ws.updatedAt = now()
      await persist(store)
      return { id: ws.id, name: ws.name, baseCurrency: ws.baseCurrency, timezone: ws.timezone, role, createdAt: ws.createdAt }
    },
  },

  stages: {
    async list(ctx) {
      const { store, ws } = await activeMembership(ctx)
      return [...store.stages.values()]
        .filter((s) => s.workspaceId === ws.id)
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ id: s.id, name: s.name, position: s.position, kind: s.kind }))
    },

    async replace(ctx, stages) {
      const { store, ws } = await activeMembership(ctx)
      const kinds = stages.map((s) => s.kind)
      if (kinds.filter((k) => k === "open").length < 1)
        throw errors.badRequest("Keep at least one open stage")
      if (kinds.filter((k) => k === "won").length !== 1)
        throw errors.badRequest("You need exactly one Won stage")
      if (kinds.filter((k) => k === "lost").length !== 1)
        throw errors.badRequest("You need exactly one Lost stage")

      const wsStages = [...store.stages.values()].filter((s) => s.workspaceId === ws.id)
      const wsDeals = [...store.deals.values()].filter((d) => d.workspaceId === ws.id)

      // Keep ids for stages sent with one; create rows for new ones.
      const newStages: StageRow[] = stages.map((s, index) => {
        const existing = s.id ? wsStages.find((row) => row.id === s.id) : undefined
        if (existing && existing.workspaceId !== ws.id) throw errors.badRequest("Stage does not belong to this workspace")
        return {
          id: existing ? existing.id : uid(),
          workspaceId: ws.id,
          name: s.name,
          position: index,
          kind: s.kind,
        }
      })

      // Block removing a stage that still has deals on it.
      for (const old of wsStages) {
        const kept = newStages.some((s) => s.id === old.id)
        const hasDeals = wsDeals.some((d) => d.stageId === old.id)
        if (!kept && hasDeals) {
          throw errors.badRequest(`Stage "${old.name}" still has deals on it — move them to another stage first`)
        }
      }

      for (const old of wsStages) store.stages.delete(old.id)
      for (const s of newStages) store.stages.set(s.id, s)
      await persist(store)
      return newStages
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ id: s.id, name: s.name, position: s.position, kind: s.kind }))
    },
  },

  contacts: {
    async list(ctx, query) {
      const { store, ws } = await activeMembership(ctx)
      const all = [...store.contacts.values()].filter((c) => c.workspaceId === ws.id)
      const search = query.search?.toLowerCase().trim()
      let filtered = all
      if (search) {
        filtered = filtered.filter((c) =>
          [c.firstName, c.lastName, c.email ?? "", c.phone ?? "", companyName(store, c.companyId) ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(search)
        )
      }
      if (query.status) filtered = filtered.filter((c) => c.status === query.status)
      if (query.ownerId) filtered = filtered.filter((c) => c.ownerId === query.ownerId)
      if (query.companyId) filtered = filtered.filter((c) => c.companyId === query.companyId)
      const sorted = filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return {
        items: sorted.slice(query.offset, query.offset + query.limit).map((c) => toContact(store, c)),
        total: sorted.length,
      }
    },

    async get(ctx, id) {
      const { store, ws } = await activeMembership(ctx)
      const c = store.contacts.get(id)
      if (!c || c.workspaceId !== ws.id) throw errors.notFound("Contact not found")
      const deals = [...store.deals.values()]
        .filter((d) => d.workspaceId === ws.id && d.contactId === c.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((d) => toDeal(store, d))
      const tasks = [...store.tasks.values()]
        .filter((t) => t.workspaceId === ws.id && t.contactId === c.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((t) => toTask(store, t))
      const notes = [...store.notes.values()]
        .filter((n) => n.entityType === "contact" && n.entityId === c.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((n) => toNote(store, n))
      const company = c.companyId ? (store.companies.get(c.companyId) ?? null) : null
      return {
        ...toContact(store, c),
        company: company ? toCompany(store, company) : null,
        deals,
        tasks,
        notes,
      }
    },

    async create(ctx, input) {
      const { store, user, ws } = await activeMembership(ctx)
      const row: ContactRow = {
        id: uid(),
        workspaceId: ws.id,
        firstName: input.firstName,
        lastName: input.lastName ?? "",
        email: input.email ?? null,
        phone: input.phone ?? null,
        jobTitle: input.jobTitle ?? null,
        status: (input.status ?? "lead") as ContactStatus,
        companyId: input.companyId ?? null,
        ownerId: input.ownerId ?? user.id,
        city: input.city ?? null,
        state: input.state ?? null,
        country: input.country ?? null,
        createdAt: now(),
        updatedAt: now(),
      }
      if (row.companyId && !store.companies.get(row.companyId)) throw errors.badRequest("Company not found")
      store.contacts.set(row.id, row)
      await persist(store)
      return toContact(store, row)
    },

    async update(ctx, id, input) {
      const { store, ws } = await activeMembership(ctx)
      const c = store.contacts.get(id)
      if (!c || c.workspaceId !== ws.id) throw errors.notFound("Contact not found")
      if (input.firstName !== undefined) c.firstName = input.firstName
      if (input.lastName !== undefined) c.lastName = input.lastName ?? ""
      if (input.email !== undefined) c.email = input.email ?? null
      if (input.phone !== undefined) c.phone = input.phone ?? null
      if (input.jobTitle !== undefined) c.jobTitle = input.jobTitle ?? null
      if (input.status !== undefined) c.status = input.status
      if (input.companyId !== undefined) c.companyId = input.companyId ?? null
      if (input.ownerId !== undefined) c.ownerId = input.ownerId ?? null
      if (input.city !== undefined) c.city = input.city ?? null
      if (input.state !== undefined) c.state = input.state ?? null
      if (input.country !== undefined) c.country = input.country ?? null
      c.updatedAt = now()
      await persist(store)
      return toContact(store, c)
    },

    async delete(ctx, id) {
      const { store, ws } = await activeMembership(ctx)
      const c = store.contacts.get(id)
      if (!c || c.workspaceId !== ws.id) throw errors.notFound("Contact not found")
      store.contacts.delete(id)
      for (const d of store.deals.values()) {
        if (d.contactId === id) {
          d.contactId = null
          d.updatedAt = now()
        }
      }
      for (const t of store.tasks.values()) {
        if (t.contactId === id) t.contactId = null
      }
      for (const n of [...store.notes.values()]) {
        if (n.entityType === "contact" && n.entityId === id) store.notes.delete(n.id)
      }
      await persist(store)
    },
  },

  companies: {
    async list(ctx, query) {
      const { store, ws } = await activeMembership(ctx)
      let all = [...store.companies.values()].filter((c) => c.workspaceId === ws.id)
      const search = query.search?.toLowerCase().trim()
      if (search) {
        all = all.filter((c) =>
          [c.name, c.domain ?? "", c.industry ?? "", c.city ?? "", c.country ?? ""].join(" ").toLowerCase().includes(search)
        )
      }
      const sorted = all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return {
        items: sorted.slice(query.offset, query.offset + query.limit).map((c) => toCompany(store, c)),
        total: sorted.length,
      }
    },

    async create(ctx, input) {
      const { store, user, ws } = await activeMembership(ctx)
      const row: CompanyRow = {
        id: uid(),
        workspaceId: ws.id,
        name: input.name,
        domain: input.domain ?? null,
        industry: input.industry ?? null,
        phone: input.phone ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        country: input.country ?? null,
        ownerId: input.ownerId ?? user.id,
        createdAt: now(),
        updatedAt: now(),
      }
      store.companies.set(row.id, row)
      await persist(store)
      return toCompany(store, row)
    },

    async update(ctx, id, input) {
      const { store, ws } = await activeMembership(ctx)
      const c = store.companies.get(id)
      if (!c || c.workspaceId !== ws.id) throw errors.notFound("Company not found")
      if (input.name !== undefined) c.name = input.name
      if (input.domain !== undefined) c.domain = input.domain ?? null
      if (input.industry !== undefined) c.industry = input.industry ?? null
      if (input.phone !== undefined) c.phone = input.phone ?? null
      if (input.city !== undefined) c.city = input.city ?? null
      if (input.state !== undefined) c.state = input.state ?? null
      if (input.country !== undefined) c.country = input.country ?? null
      if (input.ownerId !== undefined) c.ownerId = input.ownerId ?? null
      c.updatedAt = now()
      await persist(store)
      return toCompany(store, c)
    },

    async delete(ctx, id) {
      const { store, ws } = await activeMembership(ctx)
      const c = store.companies.get(id)
      if (!c || c.workspaceId !== ws.id) throw errors.notFound("Company not found")
      store.companies.delete(id)
      for (const ct of store.contacts.values()) {
        if (ct.companyId === id) {
          ct.companyId = null
          ct.updatedAt = now()
        }
      }
      for (const d of store.deals.values()) {
        if (d.companyId === id) {
          d.companyId = null
          d.updatedAt = now()
        }
      }
      await persist(store)
    },
  },

  deals: {
    async list(ctx, query) {
      const { store, ws } = await activeMembership(ctx)
      let all = [...store.deals.values()].filter((d) => d.workspaceId === ws.id)
      const search = query.search?.toLowerCase().trim()
      if (search) {
        all = all.filter((d) =>
          [d.title, contactName(store, d.contactId) ?? "", companyName(store, d.companyId) ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(search)
        )
      }
      if (query.contactId) all = all.filter((d) => d.contactId === query.contactId)
      const sorted = all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return {
        items: sorted.slice(query.offset, query.offset + query.limit).map((d) => toDeal(store, d)),
        total: sorted.length,
      }
    },

    async create(ctx, input) {
      const { store, user, ws } = await activeMembership(ctx)
      const stages = [...store.stages.values()].filter((s) => s.workspaceId === ws.id).sort((a, b) => a.position - b.position)
      if (stages.length === 0) throw errors.badRequest("This workspace has no pipeline stages yet")
      const stageId = input.stageId && stages.find((s) => s.id === input.stageId) ? input.stageId : stages[0].id
      if (input.contactId && !store.contacts.get(input.contactId)) throw errors.badRequest("Contact not found")
      if (input.companyId && !store.companies.get(input.companyId)) throw errors.badRequest("Company not found")
      const currency = input.currency && isValidCurrency(input.currency) ? input.currency : ws.baseCurrency
      const row: DealRow = {
        id: uid(),
        workspaceId: ws.id,
        title: input.title,
        amount: input.amount ?? 0,
        currency,
        stageId,
        probability: input.probability ?? 50,
        expectedCloseDate: input.expectedCloseDate ?? null,
        closedAt: null,
        contactId: input.contactId ?? null,
        companyId: input.companyId ?? null,
        ownerId: input.ownerId ?? user.id,
        createdAt: now(),
        updatedAt: now(),
      }
      store.deals.set(row.id, row)
      await persist(store)
      return toDeal(store, row)
    },

    async update(ctx, id, input) {
      const { store, ws } = await activeMembership(ctx)
      const d = store.deals.get(id)
      if (!d || d.workspaceId !== ws.id) throw errors.notFound("Deal not found")
      if (input.title !== undefined) d.title = input.title
      if (input.amount !== undefined) d.amount = input.amount
      if (input.currency !== undefined) {
        if (!isValidCurrency(input.currency)) throw errors.badRequest("Unknown currency")
        d.currency = input.currency
      }
      if (input.stageId !== undefined) {
        const stage = store.stages.get(input.stageId)
        if (!stage || stage.workspaceId !== ws.id) throw errors.badRequest("Stage not found")
        d.stageId = stage.id
        if (stage.kind === "open") d.closedAt = null
        else if (!d.closedAt) d.closedAt = now()
      }
      if (input.probability !== undefined) d.probability = input.probability
      if (input.expectedCloseDate !== undefined) d.expectedCloseDate = input.expectedCloseDate ?? null
      if (input.contactId !== undefined) d.contactId = input.contactId ?? null
      if (input.companyId !== undefined) d.companyId = input.companyId ?? null
      if (input.ownerId !== undefined) d.ownerId = input.ownerId ?? null
      d.updatedAt = now()
      await persist(store)
      return toDeal(store, d)
    },

    async delete(ctx, id) {
      const { store, ws } = await activeMembership(ctx)
      const d = store.deals.get(id)
      if (!d || d.workspaceId !== ws.id) throw errors.notFound("Deal not found")
      store.deals.delete(id)
      for (const t of store.tasks.values()) {
        if (t.dealId === id) t.dealId = null
      }
      for (const n of [...store.notes.values()]) {
        if (n.entityType === "deal" && n.entityId === id) store.notes.delete(n.id)
      }
      await persist(store)
    },
  },

  tasks: {
    async list(ctx, query) {
      const { store, ws } = await activeMembership(ctx)
      let all = [...store.tasks.values()].filter((t) => t.workspaceId === ws.id)
      if (query.status) all = all.filter((t) => t.status === query.status)
      if (query.assigneeId) all = all.filter((t) => t.assigneeId === query.assigneeId)
      if (query.contactId) all = all.filter((t) => t.contactId === query.contactId)
      if (query.dealId) all = all.filter((t) => t.dealId === query.dealId)
      const sorted = all.sort((a, b) => {
        if (a.status !== b.status) return a.status === "open" ? -1 : 1
        const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity
        const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity
        if (ad !== bd) return ad - bd
        return b.createdAt.localeCompare(a.createdAt)
      })
      return {
        items: sorted.slice(query.offset, query.offset + query.limit).map((t) => toTask(store, t)),
        total: sorted.length,
      }
    },

    async create(ctx, input) {
      const { store, user, ws } = await activeMembership(ctx)
      if (input.contactId && !store.contacts.get(input.contactId)) throw errors.badRequest("Contact not found")
      if (input.dealId && !store.deals.get(input.dealId)) throw errors.badRequest("Deal not found")
      if (input.assigneeId) {
        const member = [...store.memberships.values()].find((m) => m.workspaceId === ws.id && m.userId === input.assigneeId)
        if (!member) throw errors.badRequest("Assignee must be a member of this workspace")
      }
      const row: TaskRow = {
        id: uid(),
        workspaceId: ws.id,
        title: input.title,
        description: input.description ?? null,
        status: "open",
        priority: input.priority ?? "normal",
        dueAt: input.dueAt ?? null,
        assigneeId: input.assigneeId ?? null,
        contactId: input.contactId ?? null,
        dealId: input.dealId ?? null,
        createdBy: user.id,
        createdAt: now(),
        updatedAt: now(),
        completedAt: null,
      }
      store.tasks.set(row.id, row)
      await persist(store)
      return toTask(store, row)
    },

    async update(ctx, id, input) {
      const { store, ws } = await activeMembership(ctx)
      const t = store.tasks.get(id)
      if (!t || t.workspaceId !== ws.id) throw errors.notFound("Task not found")
      if (input.title !== undefined) t.title = input.title
      if (input.description !== undefined) t.description = input.description ?? null
      if (input.priority !== undefined) t.priority = input.priority
      if (input.dueAt !== undefined) t.dueAt = input.dueAt ?? null
      if (input.assigneeId !== undefined) t.assigneeId = input.assigneeId ?? null
      if (input.contactId !== undefined) t.contactId = input.contactId ?? null
      if (input.dealId !== undefined) t.dealId = input.dealId ?? null
      if (input.status !== undefined && input.status !== t.status) {
        t.status = input.status
        t.completedAt = input.status === "done" ? now() : null
      }
      t.updatedAt = now()
      await persist(store)
      return toTask(store, t)
    },

    async delete(ctx, id) {
      const { store, ws } = await activeMembership(ctx)
      const t = store.tasks.get(id)
      if (!t || t.workspaceId !== ws.id) throw errors.notFound("Task not found")
      store.tasks.delete(id)
      await persist(store)
    },
  },

  notes: {
    async list(ctx, entityType, entityId) {
      const { store, ws } = await activeMembership(ctx)
      if (entityType === "contact") {
        const c = store.contacts.get(entityId)
        if (!c || c.workspaceId !== ws.id) throw errors.notFound("Contact not found")
      } else {
        const d = store.deals.get(entityId)
        if (!d || d.workspaceId !== ws.id) throw errors.notFound("Deal not found")
      }
      return [...store.notes.values()]
        .filter((n) => n.entityType === entityType && n.entityId === entityId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((n) => toNote(store, n))
    },

    async create(ctx, input) {
      const { store, user, ws } = await activeMembership(ctx)
      if (input.entityType === "contact") {
        const c = store.contacts.get(input.entityId)
        if (!c || c.workspaceId !== ws.id) throw errors.notFound("Contact not found")
      } else {
        const d = store.deals.get(input.entityId)
        if (!d || d.workspaceId !== ws.id) throw errors.notFound("Deal not found")
      }
      const row: NoteRow = {
        id: uid(),
        workspaceId: ws.id,
        entityType: input.entityType,
        entityId: input.entityId,
        body: input.body,
        authorId: user.id,
        createdAt: now(),
      }
      store.notes.set(row.id, row)
      await persist(store)
      return toNote(store, row)
    },

    async delete(ctx, id) {
      const { store, ws } = await activeMembership(ctx)
      const n = store.notes.get(id)
      if (!n || n.workspaceId !== ws.id) throw errors.notFound("Note not found")
      store.notes.delete(id)
      await persist(store)
    },
  },

  async dashboard(ctx) {
    const { store, ws } = await activeMembership(ctx)
    const deals = [...store.deals.values()].filter((d) => d.workspaceId === ws.id)
    const contacts = [...store.contacts.values()].filter((c) => c.workspaceId === ws.id)
    const tasks = [...store.tasks.values()].filter((t) => t.workspaceId === ws.id)
    const stages = [...store.stages.values()].filter((s) => s.workspaceId === ws.id).sort((a, b) => a.position - b.position)

    const stageById = new Map(stages.map((s) => [s.id, s]))
    const isOpen = (d: DealRow) => stageById.get(d.stageId)?.kind === "open"
    const isWon = (d: DealRow) => stageById.get(d.stageId)?.kind === "won"

    const openPipeline = combine(
      deals.filter(isOpen).map((d) => ({ currency: d.currency, amount: d.amount }))
    )
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const wonThisMonth = combine(
      deals.filter((d) => isWon(d) && d.closedAt && new Date(d.closedAt) >= monthStart).map((d) => ({
        currency: d.currency,
        amount: d.amount,
      }))
    )

    const stageBreakdown = stages.map((s) => {
      const inStage = deals.filter((d) => d.stageId === s.id)
      return {
        id: s.id,
        name: s.name,
        kind: s.kind,
        count: inStage.length,
        value: combine(inStage.map((d) => ({ currency: d.currency, amount: d.amount }))),
      }
    })

    const wonTrend: { label: string; value: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date()
      start.setUTCMonth(start.getUTCMonth() - i, 1)
      start.setUTCHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setUTCMonth(end.getUTCMonth() + 1)
      const won = deals.filter(
        (d) => isWon(d) && d.closedAt && new Date(d.closedAt) >= start && new Date(d.closedAt) < end
      )
      const value = won.reduce((sum, d) => sum + convertApprox(d.amount, d.currency, ws.baseCurrency), 0)
      wonTrend.push({ label: start.toLocaleString("en", { month: "short" }), value })
    }

    const upcomingTasks = tasks
      .filter((t) => t.status === "open" && t.dueAt)
      .filter((t) => {
        const due = t.dueAt ? new Date(t.dueAt).getTime() : Infinity
        return due < Date.now() + 7 * 86400_000
      })
      .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
      .slice(0, 8)
      .map((t) => toTask(store, t))

    const activity: ActivityItem[] = []
    for (const c of contacts) {
      activity.push({ type: "contact", id: c.id, title: `${c.firstName} ${c.lastName}`.trim(), subtitle: "Contact", at: c.updatedAt })
    }
    for (const d of deals) {
      activity.push({ type: "deal", id: d.id, title: d.title, subtitle: `Deal · ${stageById.get(d.stageId)?.name ?? ""}`.trim(), at: d.updatedAt })
    }
    for (const t of tasks) {
      activity.push({ type: "task", id: t.id, title: t.title, subtitle: t.status === "done" ? "Task completed" : "Task", at: t.updatedAt })
    }
    activity.sort((a, b) => b.at.localeCompare(a.at))

    const openTasks = tasks.filter((t) => t.status === "open")
    return {
      baseCurrency: ws.baseCurrency,
      openPipeline,
      approxOpenPipelineBase: openPipeline.reduce((sum, e) => sum + convertApprox(e.amount, e.currency, ws.baseCurrency), 0),
      wonThisMonth,
      approxWonBase: wonThisMonth.reduce((sum, e) => sum + convertApprox(e.amount, e.currency, ws.baseCurrency), 0),
      counts: {
        contacts: contacts.length,
        newContacts7d: contacts.filter((c) => Date.now() - new Date(c.createdAt).getTime() < 7 * 86400_000).length,
        openDeals: deals.filter(isOpen).length,
        openTasks: openTasks.length,
        overdueTasks: openTasks.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < Date.now()).length,
        members: [...store.memberships.values()].filter((m) => m.workspaceId === ws.id).length,
      },
      stages: stageBreakdown,
      wonTrend,
      upcomingTasks,
      activity: activity.slice(0, 10),
    } satisfies DashboardData
  },

  team: {
    async list(ctx) {
      const { store, ws } = await activeMembership(ctx)
      const members: WorkspaceMember[] = [...store.memberships.values()]
        .filter((m) => m.workspaceId === ws.id)
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
        .map((m) => {
          const u = store.users.get(m.userId)
          return {
            id: m.id,
            userId: m.userId,
            name: u?.name ?? "Unknown",
            email: u?.email ?? "unknown",
            role: m.role,
            joinedAt: m.joinedAt,
          }
        })
      const rows = [...store.invitations.values()].filter((i) => i.workspaceId === ws.id)
      markExpiredPending(rows)
      await persist(store)
      const invitations = rows
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((row) => toInvitation(row, store))
      return { members, invitations }
    },

    async invite(ctx, email, role) {
      const { store, ws, user, role: myRole } = await activeMembership(ctx)
      requireAdmin(myRole)
      const target = email.toLowerCase()
      if ([...store.memberships.values()].some((m) => m.workspaceId === ws.id && store.users.get(m.userId)?.email === target)) {
        throw errors.conflict("This person is already a member of the workspace")
      }
      const existing = [...store.invitations.values()].filter(
        (i) => i.workspaceId === ws.id && i.email.toLowerCase() === target && i.status === "pending"
      )
      for (const old of existing) old.status = "revoked"
      const inviteeUser = [...store.users.values()].find((u) => u.email === target)
      const row: InvitationRow = {
        id: uid(),
        workspaceId: ws.id,
        email: target,
        role,
        token: uid(),
        status: "pending",
        invitedBy: user.name,
        createdAt: now(),
        expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * 86400_000).toISOString(),
        acceptedAt: null,
      }
      store.invitations.set(row.id, row)
      await persist(store)
      const inviteUrl = `${ctx.appUrl}/invite/${row.token}`
      const result = await sendInvitationEmail({
        to: target,
        inviterName: user.name,
        workspaceName: ws.name,
        inviteUrl,
        role,
        alreadyHasAccount: Boolean(inviteeUser),
        appUrl: ctx.appUrl,
      })
      return {
        invitation: toInvitation(row, store),
        emailSent: result.sent,
        inviteUrl,
      }
    },

    async revoke(ctx, invitationId) {
      const { store, ws, role } = await activeMembership(ctx)
      requireAdmin(role)
      const row = store.invitations.get(invitationId)
      if (!row || row.workspaceId !== ws.id) throw errors.notFound("Invitation not found")
      if (row.status === "pending") row.status = "revoked"
      await persist(store)
    },

    async resend(ctx, invitationId) {
      const { store, user, ws, role } = await activeMembership(ctx)
      requireAdmin(role)
      const row = store.invitations.get(invitationId)
      if (!row || row.workspaceId !== ws.id) throw errors.notFound("Invitation not found")
      if (row.status !== "pending" && row.status !== "expired") throw errors.badRequest("Only pending invitations can be resent")
      row.status = "pending"
      row.token = uid()
      row.createdAt = now()
      row.expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 86400_000).toISOString()
      await persist(store)
      const inviteUrl = `${ctx.appUrl}/invite/${row.token}`
      const inviteeUser = [...store.users.values()].find((u) => u.email === row.email)
      const result = await sendInvitationEmail({
        to: row.email,
        inviterName: user.name,
        workspaceName: ws.name,
        inviteUrl,
        role: row.role,
        alreadyHasAccount: Boolean(inviteeUser),
        appUrl: ctx.appUrl,
      })
      return {
        invitation: toInvitation(row, store),
        emailSent: result.sent,
        inviteUrl,
      }
    },

    async setMemberRole(ctx, memberId, role) {
      const { store, ws, role: myRole } = await activeMembership(ctx)
      requireAdmin(myRole)
      const m = store.memberships.get(memberId)
      if (!m || m.workspaceId !== ws.id) throw errors.notFound("Member not found")
      if (m.role === "owner") throw errors.forbidden("The workspace owner's role cannot be changed")
      if (role === "owner") throw errors.badRequest("Ownership can only be transferred by the owner in the future")
      m.role = role
      await persist(store)
    },

    async removeMember(ctx, memberId) {
      const { store, ws, role } = await activeMembership(ctx)
      requireAdmin(role)
      const m = store.memberships.get(memberId)
      if (!m || m.workspaceId !== ws.id) throw errors.notFound("Member not found")
      if (m.role === "owner") throw errors.forbidden("The workspace owner cannot be removed")
      store.memberships.delete(m.id)
      await persist(store)
    },
  },

  invitations: {
    async info(ctx, token) {
      const store = await getStore()
      const row = [...store.invitations.values()].find((i) => i.token === token)
      if (!row) return null
      if (row.status === "pending" && new Date(row.expiresAt).getTime() < Date.now()) {
        row.status = "expired"
        await persist(store)
      }
      const ws = store.workspaces.get(row.workspaceId)
      return {
        workspaceName: ws?.name ?? "Workspace",
        workspaceId: row.workspaceId,
        inviterName: row.invitedBy,
        email: row.email,
        role: row.role,
        status: row.status,
        expiresAt: row.expiresAt,
      }
    },

    async accept(ctx, token) {
      const user = await requireUser(ctx)
      const store = await getStore()
      const row = [...store.invitations.values()].find((i) => i.token === token)
      if (!row) throw errors.notFound("This invitation link is invalid")
      if (row.email.toLowerCase() !== user.email.toLowerCase()) {
        throw errors.forbidden(
          `This invitation was sent to ${row.email}. Sign in with that account (or create it) to accept.`
        )
      }
      if (row.status === "accepted") {
        /* idempotent */
      } else if (row.status === "expired" || (row.status === "pending" && new Date(row.expiresAt).getTime() < Date.now())) {
        throw errors.badRequest("This invitation has expired. Ask a workspace admin to send a new one.")
      } else if (row.status !== "pending") {
        throw errors.badRequest("This invitation is no longer active")
      } else {
        row.status = "accepted"
        row.acceptedAt = now()
        const already = [...store.memberships.values()].find(
          (m) => m.workspaceId === row.workspaceId && m.userId === user.id
        )
        if (!already) {
          const membership: MembershipRow = {
            id: uid(),
            workspaceId: row.workspaceId,
            userId: user.id,
            role: row.role,
            joinedAt: now(),
          }
          store.memberships.set(membership.id, membership)
        }
        await persist(store)
      }
      const ws = store.workspaces.get(row.workspaceId)
      if (!ws) throw errors.notFound("The workspace for this invitation no longer exists")
      ctx.cookies.set(WS_COOKIE, ws.id, { maxAge: SESSION_DAYS * 86400 })
      return toWorkspaceSummary(store, ws, user.id)
    },
  },
}

function combine(entries: { currency: string; amount: number }[]): MoneyByCurrency[] {
  const map = new Map<string, number>()
  for (const e of entries) map.set(e.currency, (map.get(e.currency) ?? 0) + e.amount)
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => (a.currency === "INR" ? -1 : b.currency === "INR" ? 1 : a.currency.localeCompare(b.currency)))
}
