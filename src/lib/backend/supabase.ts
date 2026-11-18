/**
 * SUPABASE backend — the production implementation.
 * Auth via Supabase Auth (cookies handled with @supabase/ssr); all data in
 * Supabase Postgres with service-role access from API routes after explicit
 * permission checks. Row-Level Security (see supabase/migrations) guards
 * every table so no unauthenticated/non-member token can ever read a row.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import crypto from "node:crypto"

import { errors } from "@/lib/http"
import { sendInvitationEmail, sendVerificationEmail, sendWelcomeEmail } from "@/lib/email"
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

const WS_COOKIE = "yb_ws"
const SESSION_DAYS = 30

function env(): { url: string; anon: string; service: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) return null
  return { url, anon, service }
}

let cachedAdmin: SupabaseClient | null = null
function admin(): SupabaseClient {
  const e = env()
  if (!e) throw errors.internal("Supabase is not configured on this server")
  if (!cachedAdmin) {
    cachedAdmin = createClient(e.url, e.service, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cachedAdmin
}

/** Per-request client bound to the user's browser session cookies. */
function userClient(ctx: Ctx): SupabaseClient {
  const e = env()
  if (!e) throw errors.internal("Supabase is not configured on this server")
  return createServerClient(e.url, e.anon, {
    cookies: {
      getAll: () => ctx.req.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
      setAll: (list) => {
        for (const item of list) {
          ctx.cookies.setRaw(item.name, item.value, item.options ?? {})
        }
      },
    },
  })
}

/* -------------------------------- row shapes ------------------------------- */

interface ProfileRow {
  id: string
  name: string | null
  timezone: string | null
  currency: string | null
  created_at: string
}

interface WorkspaceRow {
  id: string
  name: string
  base_currency: string
  timezone: string
  created_by: string
  created_at: string
  updated_at: string
}

interface MembershipRow {
  id: string
  workspace_id: string
  user_id: string
  role: Role
  joined_at: string
}

interface InvitationRow {
  id: string
  workspace_id: string
  email: string
  role: Role
  token: string
  status: "pending" | "accepted" | "revoked" | "expired"
  invited_by: string | null
  created_at: string
  expires_at: string
  accepted_at: string | null
}

interface StageRow {
  id: string
  workspace_id: string
  name: string
  position: number
  kind: "open" | "won" | "lost"
}

/* --------------------------------- helpers -------------------------------- */

const nowIso = (): string => new Date().toISOString()

async function requireUserRow(ctx: Ctx): Promise<{ authUserId: string; email: string; profile: ProfileRow }> {
  const client = userClient(ctx)
  const { data, error } = await client.auth.getUser()
  if (error || !data?.user) throw errors.unauthorized()
  const email = data.user.email ?? ""
  const { data: profile } = await admin()
    .from("profiles")
    .select("id, name, timezone, currency, created_at")
    .eq("id", data.user.id)
    .maybeSingle()
  if (profile) return { authUserId: data.user.id, email, profile: profile as ProfileRow }
  // Fallback: create the profile if the trigger missed it (e.g. legacy users)
  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
  const created = {
    id: data.user.id,
    name: typeof meta.name === "string" ? meta.name : email.split("@")[0],
    timezone: typeof meta.timezone === "string" ? meta.timezone : "UTC",
    currency: typeof meta.currency === "string" ? meta.currency : "INR",
    created_at: nowIso(),
  }
  await admin().from("profiles").insert(created)
  return { authUserId: data.user.id, email, profile: created }
}

async function activeMembership(ctx: Ctx): Promise<{
  user: { authUserId: string; email: string; profile: ProfileRow }
  ws: WorkspaceRow
  role: Role
}> {
  const user = await requireUserRow(ctx)
  const wsId = ctx.cookies.get(WS_COOKIE)
  if (!wsId) throw errors.badRequest("No active workspace. Create or switch to a workspace first.")
  const { data: membership } = await admin()
    .from("workspace_members")
    .select("id, workspace_id, user_id, role, joined_at")
    .eq("workspace_id", wsId)
    .eq("user_id", user.authUserId)
    .maybeSingle()
  if (!membership) throw errors.badRequest("No active workspace. Create or switch to a workspace first.")
  const { data: ws } = await admin()
    .from("workspaces")
    .select("id, name, base_currency, timezone, created_by, created_at, updated_at")
    .eq("id", wsId)
    .maybeSingle()
  if (!ws) throw errors.badRequest("No active workspace. Create or switch to a workspace first.")
  return { user, ws: ws as WorkspaceRow, role: (membership as MembershipRow).role }
}

function requireAdmin(role: Role): void {
  if (role !== "owner" && role !== "admin") {
    throw errors.forbidden("Only workspace owners and admins can do that")
  }
}

function toUserProfile(profile: ProfileRow, email: string): UserProfile {
  return {
    id: profile.id,
    email,
    name: profile.name ?? "",
    timezone: profile.timezone ?? "UTC",
    currency: profile.currency ?? "INR",
    createdAt: profile.created_at,
  }
}

function toWorkspaceSummary(ws: WorkspaceRow, role: Role): WorkspaceSummary {
  return {
    id: ws.id,
    name: ws.name,
    baseCurrency: ws.base_currency,
    timezone: ws.timezone,
    role,
    createdAt: ws.created_at,
  }
}

/** Fetch many profile names by user ids. */
async function profileNameMap(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id) => id && id.length > 0))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map
  const { data } = await admin().from("profiles").select("id, name").in("id", unique)
  for (const row of (data ?? []) as { id: string; name: string | null }[]) {
    map.set(row.id, row.name ?? "Unknown")
  }
  return map
}

function sanitizeSearch(term: string | undefined): string {
  if (!term) return ""
  return term.replace(/[,()%\\]/g, " ").trim()
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

/* =============================== the backend ============================== */

export const supabaseBackend: Backend = {
  mode: "supabase",

  auth: {
    async signup(ctx, input) {
      const e = env()
      if (!e) throw errors.internal("Supabase is not configured on this server")
      const email = input.email.toLowerCase()
      const resendConfigured = Boolean(process.env.RESEND_API_KEY)

      if (resendConfigured) {
        // Create the user (unconfirmed) and get a verification link to email.
        const { data, error } = await admin().auth.admin.generateLink({
          type: "signup",
          email,
          password: input.password,
          options: {
            data: { name: input.name, timezone: input.timezone, currency: input.currency },
            redirectTo: `${ctx.appUrl}/login`,
          },
        })
        if (error || !data?.properties?.action_link) {
          if (error && /already registered|already exists/i.test(error.message)) {
            throw errors.conflict("An account with this email already exists. Try signing in instead.")
          }
          throw errors.badRequest("We could not create your account. " + (error?.message ?? "Please try again."))
        }
        const result = await sendVerificationEmail({
          to: email,
          name: input.name,
          verifyUrl: data.properties.action_link,
        })
        if (!result.sent) {
          throw errors.internal(
            "Your account was created but we could not send the verification email. Please contact support."
          )
        }
        return { user: {
          id: "",
          email,
          name: input.name,
          timezone: input.timezone,
          currency: input.currency,
          createdAt: nowIso(),
        }, needsVerification: true }
      }

      // No Resend configured: auto-confirm and sign straight in.
      const { data: created, error } = await admin().auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true,
        user_metadata: { name: input.name, timezone: input.timezone, currency: input.currency },
      })
      if (error || !created?.user) {
        if (error && /already registered|already exists/i.test(error.message)) {
          throw errors.conflict("An account with this email already exists. Try signing in instead.")
        }
        throw errors.badRequest("We could not create your account. " + (error?.message ?? "Please try again."))
      }
      const client = userClient(ctx)
      const { error: signInError } = await client.auth.signInWithPassword({ email, password: input.password })
      if (signInError) throw errors.badRequest("Account created — please sign in to continue.")
      void sendWelcomeEmail(email, input.name, ctx.appUrl).catch(() => undefined)
      const profile = {
        id: created.user.id,
        name: input.name,
        timezone: input.timezone,
        currency: input.currency,
        created_at: nowIso(),
      } satisfies ProfileRow
      return { user: toUserProfile(profile, email), needsVerification: false }
    },

    async login(ctx, email, password) {
      const client = userClient(ctx)
      const { error } = await client.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      })
      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          throw errors.unauthorized("Please confirm your email first — check your inbox for the link we sent you.")
        }
        if (/invalid login credentials/i.test(error.message)) {
          throw errors.unauthorized("Incorrect email or password")
        }
        throw errors.unauthorized(error.message)
      }
      const user = await requireUserRow(ctx)
      return toUserProfile(user.profile, user.email)
    },

    async logout(ctx) {
      const client = userClient(ctx)
      await client.auth.signOut()
      ctx.cookies.delete(WS_COOKIE)
    },

    async currentUser(ctx) {
      try {
        const user = await requireUserRow(ctx)
        return toUserProfile(user.profile, user.email)
      } catch {
        return null
      }
    },

    async updateProfile(ctx, input) {
      const user = await requireUserRow(ctx)
      const patch: Record<string, string> = {}
      if (input.name !== undefined) patch.name = input.name
      if (input.timezone !== undefined) {
        if (!isValidTimezone(input.timezone)) throw errors.badRequest("Unknown timezone")
        patch.timezone = input.timezone
      }
      if (input.currency !== undefined) {
        if (!isValidCurrency(input.currency)) throw errors.badRequest("Unknown currency")
        patch.currency = input.currency
      }
      const { error } = await admin().from("profiles").update(patch).eq("id", user.authUserId)
      if (error) throw errors.internal("Could not save your profile")
      const merged: ProfileRow = {
        ...user.profile,
        name: patch.name ?? user.profile.name,
        timezone: patch.timezone ?? user.profile.timezone,
        currency: patch.currency ?? user.profile.currency,
      }
      return toUserProfile(merged, user.email)
    },

    async changePassword(ctx, currentPassword, newPassword) {
      const user = await requireUserRow(ctx)
      const e = env()
      if (!e) throw errors.internal("Supabase is not configured on this server")
      const probe = createClient(e.url, e.anon, { auth: { persistSession: false } })
      const { error: probeError } = await probe.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (probeError) throw errors.badRequest("Current password is incorrect")
      const { error } = await admin().auth.admin.updateUserById(user.authUserId, { password: newPassword })
      if (error) throw errors.badRequest("Could not update your password: " + error.message)
    },
  },

  workspaces: {
    async create(ctx, input) {
      const user = await requireUserRow(ctx)
      const baseCurrency = input.baseCurrency && isValidCurrency(input.baseCurrency) ? input.baseCurrency : "INR"
      const timezone = input.timezone && isValidTimezone(input.timezone) ? input.timezone : "UTC"
      const { data: ws, error } = await admin()
        .from("workspaces")
        .insert({
          name: input.name,
          base_currency: baseCurrency,
          timezone,
          created_by: user.authUserId,
        })
        .select("id, name, base_currency, timezone, created_by, created_at, updated_at")
        .single()
      if (error || !ws) throw errors.internal("Could not create the workspace")
      const { error: memberError } = await admin().from("workspace_members").insert({
        workspace_id: (ws as WorkspaceRow).id,
        user_id: user.authUserId,
        role: "owner",
      })
      if (memberError) throw errors.internal("Could not set you as the workspace owner")
      const { error: stageError } = await admin().from("pipeline_stages").insert(
        DEFAULT_STAGES.map((s, index) => ({
          workspace_id: (ws as WorkspaceRow).id,
          name: s.name,
          position: index,
          kind: s.kind,
        }))
      )
      if (stageError) throw errors.internal("Could not set up the deal pipeline")
      ctx.cookies.set(WS_COOKIE, (ws as WorkspaceRow).id, { maxAge: SESSION_DAYS * 86400 })
      return toWorkspaceSummary(ws as WorkspaceRow, "owner")
    },

    async list(ctx) {
      const user = await requireUserRow(ctx)
      const { data: memberships } = await admin()
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.authUserId)
      if (!memberships || memberships.length === 0) return []
      const ids = (memberships as { workspace_id: string }[]).map((m) => m.workspace_id)
      const { data: workspaces } = await admin()
        .from("workspaces")
        .select("id, name, base_currency, timezone, created_by, created_at, updated_at")
        .in("id", ids)
        .order("created_at", { ascending: true })
      const roleByWs = new Map(
        (memberships as { workspace_id: string; role: Role }[]).map((m) => [m.workspace_id, m.role])
      )
      return ((workspaces ?? []) as WorkspaceRow[]).map((ws) =>
        toWorkspaceSummary(ws, roleByWs.get(ws.id) ?? "member")
      )
    },

    async getActive(ctx) {
      try {
        const { ws, role } = await activeMembership(ctx)
        return toWorkspaceSummary(ws, role)
      } catch {
        return null
      }
    },

    async switch(ctx, workspaceId) {
      const user = await requireUserRow(ctx)
      const { data: membership } = await admin()
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.authUserId)
        .maybeSingle()
      if (!membership) throw errors.notFound("Workspace not found or you are not a member of it")
      const { data: ws } = await admin()
        .from("workspaces")
        .select("id, name, base_currency, timezone, created_by, created_at, updated_at")
        .eq("id", workspaceId)
        .maybeSingle()
      if (!ws) throw errors.notFound("Workspace not found")
      ctx.cookies.set(WS_COOKIE, workspaceId, { maxAge: SESSION_DAYS * 86400 })
      return toWorkspaceSummary(ws as WorkspaceRow, (membership as { role: Role }).role)
    },

    async update(ctx, input) {
      const { ws, role } = await activeMembership(ctx)
      requireAdmin(role)
      const patch: Record<string, string> = {}
      if (input.name !== undefined) patch.name = input.name
      if (input.baseCurrency !== undefined) {
        if (!isValidCurrency(input.baseCurrency)) throw errors.badRequest("Unknown currency")
        patch.base_currency = input.baseCurrency
      }
      if (input.timezone !== undefined) {
        if (!isValidTimezone(input.timezone)) throw errors.badRequest("Unknown timezone")
        patch.timezone = input.timezone
      }
      const { error } = await admin().from("workspaces").update(patch).eq("id", ws.id)
      if (error) throw errors.internal("Could not save workspace settings")
      return toWorkspaceSummary({ ...ws, ...camelPatch(input) } as WorkspaceRow, role)
    },
  },

  stages: {
    async list(ctx) {
      const { ws } = await activeMembership(ctx)
      const { data } = await admin()
        .from("pipeline_stages")
        .select("id, workspace_id, name, position, kind")
        .eq("workspace_id", ws.id)
        .order("position", { ascending: true })
      return ((data ?? []) as StageRow[]).map((s) => ({
        id: s.id,
        name: s.name,
        position: s.position,
        kind: s.kind,
      }))
    },

    async replace(ctx, stages) {
      const { ws } = await activeMembership(ctx)
      const kinds = stages.map((s) => s.kind)
      if (kinds.filter((k) => k === "open").length < 1)
        throw errors.badRequest("Keep at least one open stage")
      if (kinds.filter((k) => k === "won").length !== 1)
        throw errors.badRequest("You need exactly one Won stage")
      if (kinds.filter((k) => k === "lost").length !== 1)
        throw errors.badRequest("You need exactly one Lost stage")

      const { data: existing } = await admin()
        .from("pipeline_stages")
        .select("id, workspace_id, name, position, kind")
        .eq("workspace_id", ws.id)
      const current = (existing ?? []) as StageRow[]
      const currentIds = new Set(current.map((s) => s.id))
      const sentIds = new Set(stages.map((s) => s.id).filter(Boolean) as string[])

      const dropped = current.filter((s) => !sentIds.has(s.id))
      if (dropped.length > 0) {
        const { count } = await admin()
          .from("deals")
          .select("id", { count: "exact", head: true })
          .in("stage_id", dropped.map((s) => s.id))
        if ((count ?? 0) > 0) {
          throw errors.badRequest(
            `Some stages you removed still have deals on them — move those deals to another stage first`
          )
        }
      }

      for (let index = 0; index < stages.length; index++) {
        const stage = stages[index]
        if (stage.id && currentIds.has(stage.id)) {
          await admin()
            .from("pipeline_stages")
            .update({ name: stage.name, kind: stage.kind, position: index })
            .eq("id", stage.id)
        } else {
          await admin().from("pipeline_stages").insert({
            workspace_id: ws.id,
            name: stage.name,
            kind: stage.kind,
            position: index,
          })
        }
      }
      if (dropped.length > 0) {
        await admin().from("pipeline_stages").delete().in("id", dropped.map((s) => s.id))
      }
      return this.list(ctx)
    },
  },

  contacts: {
    async list(ctx, query) {
      const { ws } = await activeMembership(ctx)
      let req = admin()
        .from("contacts")
        .select("id, workspace_id, first_name, last_name, email, phone, job_title, status, company_id, owner_id, city, state, country, created_at, updated_at", { count: "exact" })
        .eq("workspace_id", ws.id)
        .order("updated_at", { ascending: false })
        .range(query.offset, query.offset + query.limit - 1)
      const term = sanitizeSearch(query.search)
      if (term) {
        req = req.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
      }
      if (query.status) req = req.eq("status", query.status)
      if (query.ownerId) req = req.eq("owner_id", query.ownerId)
      if (query.companyId) req = req.eq("company_id", query.companyId)
      const { data, count } = await req
      const rows = (data ?? []) as ContactRowLite[]
      const [ownerMap, companyMap] = await Promise.all([
        profileNameMap(rows.map((r) => r.owner_id ?? "")),
        companyNameMap(rows.map((r) => r.company_id ?? "")),
      ])
      return {
        items: rows.map((r) => contactRowToContact(r, ownerMap, companyMap)),
        total: count ?? rows.length,
      }
    },

    async get(ctx, id) {
      const { ws } = await activeMembership(ctx)
      const { data: row } = await admin()
        .from("contacts")
        .select("id, workspace_id, first_name, last_name, email, phone, job_title, status, company_id, owner_id, city, state, country, created_at, updated_at")
        .eq("workspace_id", ws.id)
        .eq("id", id)
        .maybeSingle()
      if (!row) throw errors.notFound("Contact not found")
      const contactRow = row as ContactRowLite
      const [ownerMap, companyMap] = await Promise.all([
        profileNameMap([contactRow.owner_id ?? ""]),
        companyNameMap([contactRow.company_id ?? ""]),
      ])
      const company = contactRow.company_id ? await fetchCompany(contactRow.company_id) : null
      const { data: dealRows } = await admin()
        .from("deals")
        .select("*")
        .eq("workspace_id", ws.id)
        .eq("contact_id", id)
        .order("updated_at", { ascending: false })
      const { data: taskRows } = await admin()
        .from("tasks")
        .select("*")
        .eq("workspace_id", ws.id)
        .eq("contact_id", id)
        .order("created_at", { ascending: false })
      const { data: noteRows } = await admin()
        .from("notes")
        .select("*")
        .eq("workspace_id", ws.id)
        .eq("entity_type", "contact")
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
      const stages = await listStages(ws.id)
      const deals = await assembleDeals((dealRows ?? []) as DealRow[], stages)
      const tasks = await assembleTasks((taskRows ?? []) as TaskRowLite[])
      const notes = await assembleNotes((noteRows ?? []) as NoteRowLite[])
      return {
        ...contactRowToContact(contactRow, ownerMap, companyMap),
        company,
        deals,
        tasks,
        notes,
      }
    },

    async create(ctx, input) {
      const { ws, user } = await activeMembership(ctx)
      const insert = {
        workspace_id: ws.id,
        first_name: input.firstName,
        last_name: input.lastName ?? "",
        email: input.email ?? null,
        phone: input.phone ?? null,
        job_title: input.jobTitle ?? null,
        status: input.status ?? "lead",
        company_id: input.companyId ?? null,
        owner_id: input.ownerId ?? user.authUserId,
        city: input.city ?? null,
        state: input.state ?? null,
        country: input.country ?? null,
      }
      const { data, error } = await admin().from("contacts").insert(insert).select("*").single()
      if (error) throw errors.badRequest("Could not create the contact. " + error.message)
      const row = data as ContactRowLite
      const [ownerMap, companyMap] = await Promise.all([
        profileNameMap([row.owner_id ?? ""]),
        companyNameMap([row.company_id ?? ""]),
      ])
      return contactRowToContact(row, ownerMap, companyMap)
    },

    async update(ctx, id, input) {
      const { ws } = await activeMembership(ctx)
      const patch: Record<string, unknown> = {}
      if (input.firstName !== undefined) patch.first_name = input.firstName
      if (input.lastName !== undefined) patch.last_name = input.lastName ?? ""
      if (input.email !== undefined) patch.email = input.email ?? null
      if (input.phone !== undefined) patch.phone = input.phone ?? null
      if (input.jobTitle !== undefined) patch.job_title = input.jobTitle ?? null
      if (input.status !== undefined) patch.status = input.status
      if (input.companyId !== undefined) patch.company_id = input.companyId ?? null
      if (input.ownerId !== undefined) patch.owner_id = input.ownerId ?? null
      if (input.city !== undefined) patch.city = input.city ?? null
      if (input.state !== undefined) patch.state = input.state ?? null
      if (input.country !== undefined) patch.country = input.country ?? null
      if (Object.keys(patch).length === 0) {
        const { data } = await admin().from("contacts").select("*").eq("id", id).maybeSingle()
        if (!data || (data as ContactRowLite).workspace_id !== ws.id) throw errors.notFound("Contact not found")
        return contactRowToContact(data as ContactRowLite, await profileNameMap([(data as ContactRowLite).owner_id ?? ""]), await companyNameMap([(data as ContactRowLite).company_id ?? ""]))
      }
      const { data, error } = await admin()
        .from("contacts")
        .update(patch)
        .eq("workspace_id", ws.id)
        .eq("id", id)
        .select("*")
        .single()
      if (error || !data) throw errors.notFound("Contact not found")
      const row = data as ContactRowLite
      const [ownerMap, companyMap] = await Promise.all([
        profileNameMap([row.owner_id ?? ""]),
        companyNameMap([row.company_id ?? ""]),
      ])
      return contactRowToContact(row, ownerMap, companyMap)
    },

    async delete(ctx, id) {
      const { ws } = await activeMembership(ctx)
      // Detach references first — FKs apply even to the service role.
      await admin().from("deals").update({ contact_id: null }).eq("contact_id", id)
      await admin().from("tasks").update({ contact_id: null }).eq("contact_id", id)
      await admin().from("notes").delete().eq("entity_type", "contact").eq("entity_id", id)
      const { error } = await admin().from("contacts").delete().eq("workspace_id", ws.id).eq("id", id)
      if (error) throw errors.internal("Could not delete the contact")
    },
  },

  companies: {
    async list(ctx, query) {
      const { ws } = await activeMembership(ctx)
      let req = admin()
        .from("companies")
        .select("*", { count: "exact" })
        .eq("workspace_id", ws.id)
        .order("updated_at", { ascending: false })
        .range(query.offset, query.offset + query.limit - 1)
      const term = sanitizeSearch(query.search)
      if (term) {
        req = req.or(`name.ilike.%${term}%,domain.ilike.%${term}%,industry.ilike.%${term}%,city.ilike.%${term}%,country.ilike.%${term}%`)
      }
      const { data, count } = await req
      const rows = (data ?? []) as CompanyRowLite[]
      const ownerMap = await profileNameMap(rows.map((r) => r.owner_id ?? ""))
      const contactCounts = await contactCountByCompany(ws.id)
      return {
        items: rows.map((r) => companyRowToCompany(r, ownerMap, contactCounts)),
        total: count ?? rows.length,
      }
    },

    async create(ctx, input) {
      const { ws, user } = await activeMembership(ctx)
      const { data, error } = await admin()
        .from("companies")
        .insert({
          workspace_id: ws.id,
          name: input.name,
          domain: input.domain ?? null,
          industry: input.industry ?? null,
          phone: input.phone ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          country: input.country ?? null,
          owner_id: input.ownerId ?? user.authUserId,
        })
        .select("*")
        .single()
      if (error) throw errors.badRequest("Could not create the company. " + error.message)
      const row = data as CompanyRowLite
      const ownerMap = await profileNameMap([row.owner_id ?? ""])
      return companyRowToCompany(row, ownerMap, new Map())
    },

    async update(ctx, id, input) {
      const { ws } = await activeMembership(ctx)
      const patch: Record<string, unknown> = {}
      if (input.name !== undefined) patch.name = input.name
      if (input.domain !== undefined) patch.domain = input.domain ?? null
      if (input.industry !== undefined) patch.industry = input.industry ?? null
      if (input.phone !== undefined) patch.phone = input.phone ?? null
      if (input.city !== undefined) patch.city = input.city ?? null
      if (input.state !== undefined) patch.state = input.state ?? null
      if (input.country !== undefined) patch.country = input.country ?? null
      if (input.ownerId !== undefined) patch.owner_id = input.ownerId ?? null
      const { data, error } = await admin()
        .from("companies")
        .update(patch)
        .eq("workspace_id", ws.id)
        .eq("id", id)
        .select("*")
        .single()
      if (error || !data) throw errors.notFound("Company not found")
      const row = data as CompanyRowLite
      const ownerMap = await profileNameMap([row.owner_id ?? ""])
      return companyRowToCompany(row, ownerMap, new Map())
    },

    async delete(ctx, id) {
      const { ws } = await activeMembership(ctx)
      await admin().from("contacts").update({ company_id: null }).eq("company_id", id)
      await admin().from("deals").update({ company_id: null }).eq("company_id", id)
      const { error } = await admin().from("companies").delete().eq("workspace_id", ws.id).eq("id", id)
      if (error) throw errors.internal("Could not delete the company")
    },
  },

  deals: {
    async list(ctx, query) {
      const { ws } = await activeMembership(ctx)
      let req = admin()
        .from("deals")
        .select("*", { count: "exact" })
        .eq("workspace_id", ws.id)
        .order("updated_at", { ascending: false })
        .range(query.offset, query.offset + query.limit - 1)
      const term = sanitizeSearch(query.search)
      if (term) req = req.or(`title.ilike.%${term}%`)
      if (query.contactId) req = req.eq("contact_id", query.contactId)
      const { data, count } = await req
      const stages = await listStages(ws.id)
      const deals = await assembleDeals((data ?? []) as DealRow[], stages)
      return { items: deals, total: count ?? deals.length }
    },

    async create(ctx, input) {
      const { ws, user } = await activeMembership(ctx)
      const stages = await listStages(ws.id)
      if (stages.length === 0) throw errors.badRequest("This workspace has no pipeline stages yet")
      const stageId = input.stageId && stages.find((s) => s.id === input.stageId) ? input.stageId : stages[0].id
      const currency = input.currency && isValidCurrency(input.currency) ? input.currency : ws.base_currency
      if (input.contactId) {
        const { count } = await admin().from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("id", input.contactId)
        if ((count ?? 0) === 0) throw errors.badRequest("Contact not found")
      }
      if (input.companyId) {
        const { count } = await admin().from("companies").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("id", input.companyId)
        if ((count ?? 0) === 0) throw errors.badRequest("Company not found")
      }
      const { data, error } = await admin()
        .from("deals")
        .insert({
          workspace_id: ws.id,
          title: input.title,
          amount: input.amount ?? 0,
          currency,
          stage_id: stageId,
          probability: input.probability ?? 50,
          expected_close_date: input.expectedCloseDate ?? null,
          contact_id: input.contactId ?? null,
          company_id: input.companyId ?? null,
          owner_id: input.ownerId ?? user.authUserId,
        })
        .select("*")
        .single()
      if (error) throw errors.badRequest("Could not create the deal. " + error.message)
      const deals = await assembleDeals([data as DealRow], stages)
      return deals[0]
    },

    async update(ctx, id, input) {
      const { ws } = await activeMembership(ctx)
      const patch: Record<string, unknown> = {}
      if (input.title !== undefined) patch.title = input.title
      if (input.amount !== undefined) patch.amount = input.amount
      if (input.currency !== undefined) {
        if (!isValidCurrency(input.currency)) throw errors.badRequest("Unknown currency")
        patch.currency = input.currency
      }
      if (input.probability !== undefined) patch.probability = input.probability
      if (input.expectedCloseDate !== undefined) patch.expected_close_date = input.expectedCloseDate ?? null
      if (input.contactId !== undefined) patch.contact_id = input.contactId ?? null
      if (input.companyId !== undefined) patch.company_id = input.companyId ?? null
      if (input.ownerId !== undefined) patch.owner_id = input.ownerId ?? null
      if (input.stageId !== undefined) {
        const { data: stage } = await admin()
          .from("pipeline_stages")
          .select("id, kind")
          .eq("workspace_id", ws.id)
          .eq("id", input.stageId)
          .maybeSingle()
        if (!stage) throw errors.badRequest("Stage not found")
        const kind = (stage as { kind: "open" | "won" | "lost" }).kind
        patch.stage_id = input.stageId
        patch.closed_at = kind === "open" ? null : nowIso()
      }
      const { data, error } = await admin()
        .from("deals")
        .update(patch)
        .eq("workspace_id", ws.id)
        .eq("id", id)
        .select("*")
        .single()
      if (error || !data) throw errors.notFound("Deal not found")
      const stages = await listStages(ws.id)
      const deals = await assembleDeals([data as DealRow], stages)
      return deals[0]
    },

    async delete(ctx, id) {
      const { ws } = await activeMembership(ctx)
      await admin().from("tasks").update({ deal_id: null }).eq("deal_id", id)
      await admin().from("notes").delete().eq("entity_type", "deal").eq("entity_id", id)
      const { error } = await admin().from("deals").delete().eq("workspace_id", ws.id).eq("id", id)
      if (error) throw errors.internal("Could not delete the deal")
    },
  },

  tasks: {
    async list(ctx, query) {
      const { ws } = await activeMembership(ctx)
      let req = admin()
        .from("tasks")
        .select("*", { count: "exact" })
        .eq("workspace_id", ws.id)
        .order("updated_at", { ascending: false })
        .range(query.offset, query.offset + query.limit - 1)
      if (query.status) req = req.eq("status", query.status)
      if (query.assigneeId) req = req.eq("assignee_id", query.assigneeId)
      if (query.contactId) req = req.eq("contact_id", query.contactId)
      if (query.dealId) req = req.eq("deal_id", query.dealId)
      const { data, count } = await req
      const tasks = await assembleTasks((data ?? []) as TaskRowLite[])
      return { items: tasks, total: count ?? tasks.length }
    },

    async create(ctx, input) {
      const { ws, user } = await activeMembership(ctx)
      if (input.contactId) {
        const { count } = await admin().from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("id", input.contactId)
        if ((count ?? 0) === 0) throw errors.badRequest("Contact not found")
      }
      if (input.dealId) {
        const { count } = await admin().from("deals").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("id", input.dealId)
        if ((count ?? 0) === 0) throw errors.badRequest("Deal not found")
      }
      if (input.assigneeId) {
        const { count } = await admin().from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("user_id", input.assigneeId)
        if ((count ?? 0) === 0) throw errors.badRequest("Assignee must be a member of this workspace")
      }
      const { data, error } = await admin()
        .from("tasks")
        .insert({
          workspace_id: ws.id,
          title: input.title,
          description: input.description ?? null,
          status: "open",
          priority: input.priority ?? "normal",
          due_at: input.dueAt ?? null,
          assignee_id: input.assigneeId ?? null,
          contact_id: input.contactId ?? null,
          deal_id: input.dealId ?? null,
          created_by: user.authUserId,
        })
        .select("*")
        .single()
      if (error) throw errors.badRequest("Could not create the task. " + error.message)
      const tasks = await assembleTasks([data as TaskRowLite])
      return tasks[0]
    },

    async update(ctx, id, input) {
      const { ws } = await activeMembership(ctx)
      const patch: Record<string, unknown> = {}
      if (input.title !== undefined) patch.title = input.title
      if (input.description !== undefined) patch.description = input.description ?? null
      if (input.priority !== undefined) patch.priority = input.priority
      if (input.dueAt !== undefined) patch.due_at = input.dueAt ?? null
      if (input.assigneeId !== undefined) patch.assignee_id = input.assigneeId ?? null
      if (input.contactId !== undefined) patch.contact_id = input.contactId ?? null
      if (input.dealId !== undefined) patch.deal_id = input.dealId ?? null
      if (input.status !== undefined) {
        patch.status = input.status
        patch.completed_at = input.status === "done" ? nowIso() : null
      }
      const { data, error } = await admin()
        .from("tasks")
        .update(patch)
        .eq("workspace_id", ws.id)
        .eq("id", id)
        .select("*")
        .single()
      if (error || !data) throw errors.notFound("Task not found")
      const tasks = await assembleTasks([data as TaskRowLite])
      return tasks[0]
    },

    async delete(ctx, id) {
      const { ws } = await activeMembership(ctx)
      const { error } = await admin().from("tasks").delete().eq("workspace_id", ws.id).eq("id", id)
      if (error) throw errors.internal("Could not delete the task")
    },
  },

  notes: {
    async list(ctx, entityType, entityId) {
      const { ws } = await activeMembership(ctx)
      await assertEntityExists(ws.id, entityType, entityId)
      const { data } = await admin()
        .from("notes")
        .select("*")
        .eq("workspace_id", ws.id)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
      return assembleNotes((data ?? []) as NoteRowLite[])
    },

    async create(ctx, input) {
      const { ws, user } = await activeMembership(ctx)
      await assertEntityExists(ws.id, input.entityType, input.entityId)
      const { data, error } = await admin()
        .from("notes")
        .insert({
          workspace_id: ws.id,
          entity_type: input.entityType,
          entity_id: input.entityId,
          body: input.body,
          author_id: user.authUserId,
        })
        .select("*")
        .single()
      if (error) throw errors.badRequest("Could not save the note. " + error.message)
      const notes = await assembleNotes([data as NoteRowLite])
      return notes[0]
    },

    async delete(ctx, id) {
      const { ws } = await activeMembership(ctx)
      const { error } = await admin().from("notes").delete().eq("workspace_id", ws.id).eq("id", id)
      if (error) throw errors.internal("Could not delete the note")
    },
  },

  async dashboard(ctx) {
    const { ws } = await activeMembership(ctx)
    const stages = await listStages(ws.id)
    const stageById = new Map(stages.map((s) => [s.id, s]))

    const { data: dealRows } = await admin()
      .from("deals")
      .select("id, workspace_id, title, amount, currency, stage_id, probability, expected_close_date, closed_at, contact_id, company_id, owner_id, created_at, updated_at")
      .eq("workspace_id", ws.id)
    const deals = (dealRows ?? []) as DealRow[]

    const { count: contactsCount } = await admin()
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws.id)
    const { count: newContacts } = await admin()
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws.id)
      .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString())
    const { data: taskRows } = await admin()
      .from("tasks")
      .select("*")
      .eq("workspace_id", ws.id)
    const tasks = (taskRows ?? []) as TaskRowLite[]
    const { count: membersCount } = await admin()
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws.id)

    const isOpen = (d: DealRow) => stageById.get(d.stage_id)?.kind === "open"
    const isWon = (d: DealRow) => stageById.get(d.stage_id)?.kind === "won"

    const openPipeline = combine(deals.filter(isOpen).map((d) => ({ currency: d.currency, amount: num(d.amount) })))
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const wonThisMonth = combine(
      deals
        .filter((d) => isWon(d) && d.closed_at && new Date(d.closed_at) >= monthStart)
        .map((d) => ({ currency: d.currency, amount: num(d.amount) }))
    )

    const stageBreakdown = stages.map((s) => {
      const inStage = deals.filter((d) => d.stage_id === s.id)
      return {
        id: s.id,
        name: s.name,
        kind: s.kind,
        count: inStage.length,
        value: combine(inStage.map((d) => ({ currency: d.currency, amount: num(d.amount) }))),
      }
    })

    const wonTrend: { label: string; value: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date()
      start.setUTCMonth(start.getUTCMonth() - i, 1)
      start.setUTCHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setUTCMonth(end.getUTCMonth() + 1)
      const value = deals
        .filter(
          (d) => isWon(d) && d.closed_at && new Date(d.closed_at) >= start && new Date(d.closed_at) < end
        )
        .reduce((sum, d) => sum + convertApprox(num(d.amount), d.currency, ws.base_currency), 0)
      wonTrend.push({ label: start.toLocaleString("en", { month: "short" }), value })
    }

    const upcomingTasks = tasks
      .filter((t) => t.status === "open" && t.due_at)
      .filter((t) => new Date(t.due_at as string).getTime() < Date.now() + 7 * 86400_000)
      .sort((a, b) => new Date(a.due_at as string).getTime() - new Date(b.due_at as string).getTime())
      .slice(0, 8)

    const activity: ActivityItem[] = []
    const { data: contactRows } = await admin()
      .from("contacts")
      .select("id, first_name, last_name, updated_at")
      .eq("workspace_id", ws.id)
      .order("updated_at", { ascending: false })
      .limit(6)
    for (const c of (contactRows ?? []) as { id: string; first_name: string; last_name: string; updated_at: string }[]) {
      activity.push({ type: "contact", id: c.id, title: `${c.first_name} ${c.last_name}`.trim(), subtitle: "Contact", at: c.updated_at })
    }
    for (const d of deals) {
      activity.push({ type: "deal", id: d.id, title: d.title, subtitle: `Deal · ${stageById.get(d.stage_id)?.name ?? ""}`.trim(), at: d.updated_at })
    }
    for (const t of tasks) {
      activity.push({ type: "task", id: t.id, title: t.title, subtitle: t.status === "done" ? "Task completed" : "Task", at: t.updated_at ?? t.created_at })
    }
    activity.sort((a, b) => b.at.localeCompare(a.at))

    const openTasks = tasks.filter((t) => t.status === "open")
    const assembled = await assembleTasks(upcomingTasks)
    return {
      baseCurrency: ws.base_currency,
      openPipeline,
      approxOpenPipelineBase: openPipeline.reduce(
        (sum, e) => sum + convertApprox(e.amount, e.currency, ws.base_currency), 0
      ),
      wonThisMonth,
      approxWonBase: wonThisMonth.reduce(
        (sum, e) => sum + convertApprox(e.amount, e.currency, ws.base_currency), 0
      ),
      counts: {
        contacts: contactsCount ?? 0,
        newContacts7d: newContacts ?? 0,
        openDeals: deals.filter(isOpen).length,
        openTasks: openTasks.length,
        overdueTasks: openTasks.filter(
          (t) => t.due_at && new Date(t.due_at).getTime() < Date.now()
        ).length,
        members: membersCount ?? 0,
      },
      stages: stageBreakdown,
      wonTrend,
      upcomingTasks: assembled,
      activity: activity.slice(0, 10),
    } satisfies DashboardData
  },

  team: {
    async list(ctx) {
      const { ws } = await activeMembership(ctx)
      const { data: memberRows } = await admin()
        .from("workspace_members")
        .select("id, workspace_id, user_id, role, joined_at")
        .eq("workspace_id", ws.id)
        .order("joined_at", { ascending: true })
      const membersRaw = (memberRows ?? []) as MembershipRow[]
      const profileMap = await profileNameMap(membersRaw.map((m) => m.user_id))
      const members: WorkspaceMember[] = []
      for (const m of membersRaw) {
        const { data: authUser } = await admin().auth.admin.getUserById(m.user_id)
        members.push({
          id: m.id,
          userId: m.user_id,
          name: profileMap.get(m.user_id) ?? "Unknown",
          email: authUser?.user?.email ?? "unknown",
          role: m.role,
          joinedAt: m.joined_at,
        })
      }
      const { data: inviteRows } = await admin()
        .from("invitations")
        .select("*")
        .eq("workspace_id", ws.id)
        .order("created_at", { ascending: false })
      const invitations: Invitation[] = []
      for (const row of (inviteRows ?? []) as InvitationRow[]) {
        invitations.push(toInvitationRow(row))
      }
      return { members, invitations }
    },

    async invite(ctx, email, role) {
      const { ws, user, role: myRole } = await activeMembership(ctx)
      requireAdmin(myRole)
      const target = email.toLowerCase()
      const { data: existingMembers } = await admin()
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", ws.id)
      const memberEmails: string[] = []
      for (const row of (existingMembers ?? []) as { user_id: string }[]) {
        const { data: u } = await admin().auth.admin.getUserById(row.user_id)
        if (u?.user?.email) memberEmails.push(u.user.email.toLowerCase())
      }
      if (memberEmails.includes(target)) {
        throw errors.conflict("This person is already a member of the workspace")
      }
      await admin()
        .from("invitations")
        .update({ status: "revoked" })
        .eq("workspace_id", ws.id)
        .eq("email", target)
        .eq("status", "pending")
      const token = crypto.randomUUID()
      const { data: inserted, error } = await admin()
        .from("invitations")
        .insert({
          workspace_id: ws.id,
          email: target,
          role,
          token,
          status: "pending",
          invited_by: user.profile.name ?? user.email,
          expires_at: new Date(Date.now() + INVITE_EXPIRY_DAYS * 86400_000).toISOString(),
        })
        .select("*")
        .single()
      if (error || !inserted) throw errors.internal("Could not create the invitation")
      const row = inserted as InvitationRow
      const { data: emailExists } = await admin().rpc("user_email_exists", { p_email: target })
      const inviteUrl = `${ctx.appUrl}/invite/${row.token}`
      const result = await sendInvitationEmail({
        to: target,
        inviterName: user.profile.name ?? user.email,
        workspaceName: ws.name,
        inviteUrl,
        role,
        alreadyHasAccount: Boolean(emailExists),
        appUrl: ctx.appUrl,
      })
      return { invitation: toInvitationRow(row), emailSent: result.sent, inviteUrl }
    },

    async revoke(ctx, invitationId) {
      const { ws, role } = await activeMembership(ctx)
      requireAdmin(role)
      const { error } = await admin()
        .from("invitations")
        .update({ status: "revoked" })
        .eq("workspace_id", ws.id)
        .eq("id", invitationId)
        .eq("status", "pending")
      if (error) throw errors.internal("Could not revoke the invitation")
    },

    async resend(ctx, invitationId) {
      const { ws, user, role } = await activeMembership(ctx)
      requireAdmin(role)
      const { data: row } = await admin()
        .from("invitations")
        .select("*")
        .eq("workspace_id", ws.id)
        .eq("id", invitationId)
        .maybeSingle()
      if (!row) throw errors.notFound("Invitation not found")
      const inv = row as InvitationRow
      if (inv.status !== "pending" && inv.status !== "expired") {
        throw errors.badRequest("Only pending invitations can be resent")
      }
      const token = crypto.randomUUID()
      const { data: updated } = await admin()
        .from("invitations")
        .update({
          status: "pending",
          token,
          created_at: nowIso(),
          expires_at: new Date(Date.now() + INVITE_EXPIRY_DAYS * 86400_000).toISOString(),
        })
        .eq("id", inv.id)
        .select("*")
        .single()
      const fresh = (updated ?? inv) as InvitationRow
      const { data: emailExists } = await admin().rpc("user_email_exists", { p_email: inv.email })
      const inviteUrl = `${ctx.appUrl}/invite/${fresh.token}`
      const result = await sendInvitationEmail({
        to: inv.email,
        inviterName: user.profile.name ?? user.email,
        workspaceName: ws.name,
        inviteUrl,
        role: inv.role,
        alreadyHasAccount: Boolean(emailExists),
        appUrl: ctx.appUrl,
      })
      return { invitation: toInvitationRow(fresh), emailSent: result.sent, inviteUrl }
    },

    async setMemberRole(ctx, memberId, role) {
      const { ws, role: myRole } = await activeMembership(ctx)
      requireAdmin(myRole)
      const { data: m } = await admin()
        .from("workspace_members")
        .select("id, role")
        .eq("workspace_id", ws.id)
        .eq("id", memberId)
        .maybeSingle()
      if (!m) throw errors.notFound("Member not found")
      if ((m as { role: Role }).role === "owner") throw errors.forbidden("The workspace owner's role cannot be changed")
      if (role === "owner") throw errors.badRequest("Ownership can only be transferred by the owner in the future")
      const { error } = await admin().from("workspace_members").update({ role }).eq("id", memberId)
      if (error) throw errors.internal("Could not update the role")
    },

    async removeMember(ctx, memberId) {
      const { ws, role } = await activeMembership(ctx)
      requireAdmin(role)
      const { data: m } = await admin()
        .from("workspace_members")
        .select("id, role")
        .eq("workspace_id", ws.id)
        .eq("id", memberId)
        .maybeSingle()
      if (!m) throw errors.notFound("Member not found")
      if ((m as { role: Role }).role === "owner") throw errors.forbidden("The workspace owner cannot be removed")
      const { error } = await admin().from("workspace_members").delete().eq("id", memberId)
      if (error) throw errors.internal("Could not remove the member")
    },
  },

  invitations: {
    async info(ctx, token) {
      const { data: row } = await admin()
        .from("invitations")
        .select("*")
        .eq("token", token)
        .maybeSingle()
      if (!row) return null
      const inv = row as InvitationRow
      if (inv.status === "pending" && new Date(inv.expires_at).getTime() < Date.now()) {
        const { data: updated } = await admin()
          .from("invitations")
          .update({ status: "expired" })
          .eq("id", inv.id)
          .select("*")
          .single()
        inv.status = "expired"
        void updated
      }
      const { data: ws } = await admin()
        .from("workspaces")
        .select("name")
        .eq("id", inv.workspace_id)
        .maybeSingle()
      const info: InvitationInfo = {
        workspaceName: (ws as { name: string } | null)?.name ?? "Workspace",
        workspaceId: inv.workspace_id,
        inviterName: inv.invited_by ?? "A teammate",
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expires_at,
      }
      return info
    },

    async accept(ctx, token) {
      const user = await requireUserRow(ctx)
      const { data: row } = await admin()
        .from("invitations")
        .select("*")
        .eq("token", token)
        .maybeSingle()
      if (!row) throw errors.notFound("This invitation link is invalid")
      const inv = row as InvitationRow
      if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
        throw errors.forbidden(
          `This invitation was sent to ${inv.email}. Sign in with that account (or create it) to accept.`
        )
      }
      if (inv.status === "accepted") {
        /* idempotent — fall through to switch */
      } else if (inv.status === "expired" || (inv.status === "pending" && new Date(inv.expires_at).getTime() < Date.now())) {
        throw errors.badRequest("This invitation has expired. Ask a workspace admin to send a new one.")
      } else if (inv.status !== "pending") {
        throw errors.badRequest("This invitation is no longer active")
      } else {
        const { data: existing } = await admin()
          .from("workspace_members")
          .select("id")
          .eq("workspace_id", inv.workspace_id)
          .eq("user_id", user.authUserId)
          .maybeSingle()
        if (!existing) {
          const { error } = await admin().from("workspace_members").insert({
            workspace_id: inv.workspace_id,
            user_id: user.authUserId,
            role: inv.role,
          })
          if (error) throw errors.internal("Could not join the workspace")
        }
        await admin().from("invitations").update({ status: "accepted", accepted_at: nowIso() }).eq("id", inv.id)
      }
      const { data: ws } = await admin()
        .from("workspaces")
        .select("id, name, base_currency, timezone, created_by, created_at, updated_at")
        .eq("id", inv.workspace_id)
        .maybeSingle()
      if (!ws) throw errors.notFound("The workspace for this invitation no longer exists")
      ctx.cookies.set(WS_COOKIE, inv.workspace_id, { maxAge: SESSION_DAYS * 86400 })
      return toWorkspaceSummary(ws as WorkspaceRow, inv.role)
    },
  },
}

/* ------------------------------ row lite types ----------------------------- */

interface ContactRowLite {
  id: string
  workspace_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  job_title: string | null
  status: string
  company_id: string | null
  owner_id: string | null
  city: string | null
  state: string | null
  country: string | null
  created_at: string
  updated_at: string
}

interface CompanyRowLite {
  id: string
  workspace_id: string
  name: string
  domain: string | null
  industry: string | null
  phone: string | null
  city: string | null
  state: string | null
  country: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
}

interface DealRow {
  id: string
  workspace_id: string
  title: string
  amount: number | string
  currency: string
  stage_id: string
  probability: number
  expected_close_date: string | null
  closed_at: string | null
  contact_id: string | null
  company_id: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
}

interface TaskRowLite {
  id: string
  workspace_id: string
  title: string
  description: string | null
  status: "open" | "done"
  priority: "low" | "normal" | "high"
  due_at: string | null
  assignee_id: string | null
  contact_id: string | null
  deal_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string | null
  completed_at: string | null
}

interface NoteRowLite {
  id: string
  workspace_id: string
  entity_type: "contact" | "deal"
  entity_id: string
  body: string
  author_id: string
  created_at: string
}

/* ------------------------------- assemble helpers -------------------------- */

async function listStages(workspaceId: string): Promise<PipelineStage[]> {
  const { data } = await admin()
    .from("pipeline_stages")
    .select("id, name, position, kind")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true })
  return ((data ?? []) as StageRow[]).map((s) => ({
    id: s.id,
    name: s.name,
    position: s.position,
    kind: s.kind,
  }))
}

async function companyNameMap(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map
  const { data } = await admin().from("companies").select("id, name").in("id", unique)
  for (const row of (data ?? []) as { id: string; name: string }[]) map.set(row.id, row.name)
  return map
}

async function contactNameMap(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map
  const { data } = await admin().from("contacts").select("id, first_name, last_name").in("id", unique)
  for (const row of (data ?? []) as { id: string; first_name: string; last_name: string }[]) {
    map.set(row.id, `${row.first_name} ${row.last_name}`.trim())
  }
  return map
}

function contactRowToContact(
  r: ContactRowLite,
  ownerMap: Map<string, string>,
  companyMap: Map<string, string>
): Contact {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone,
    jobTitle: r.job_title,
    status: r.status as ContactStatus,
    companyId: r.company_id,
    companyName: r.company_id ? (companyMap.get(r.company_id) ?? null) : null,
    ownerId: r.owner_id,
    ownerName: r.owner_id ? (ownerMap.get(r.owner_id) ?? null) : null,
    city: r.city,
    state: r.state,
    country: r.country,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function companyRowToCompany(
  r: CompanyRowLite,
  ownerMap: Map<string, string>,
  contactCounts: Map<string, number>
): Company {
  return {
    id: r.id,
    name: r.name,
    domain: r.domain,
    industry: r.industry,
    phone: r.phone,
    city: r.city,
    state: r.state,
    country: r.country,
    ownerId: r.owner_id,
    ownerName: r.owner_id ? (ownerMap.get(r.owner_id) ?? null) : null,
    createdAt: r.created_at,
    contactCount: contactCounts.get(r.id) ?? 0,
  }
}

async function fetchCompany(id: string): Promise<Company | null> {
  const { data } = await admin().from("companies").select("*").eq("id", id).maybeSingle()
  if (!data) return null
  const row = data as CompanyRowLite
  const ownerMap = await profileNameMap([row.owner_id ?? ""])
  return companyRowToCompany(row, ownerMap, new Map())
}

async function contactCountByCompany(workspaceId: string): Promise<Map<string, number>> {
  const { data } = await admin()
    .from("contacts")
    .select("company_id")
    .eq("workspace_id", workspaceId)
  const map = new Map<string, number>()
  for (const row of (data ?? []) as { company_id: string | null }[]) {
    if (row.company_id) map.set(row.company_id, (map.get(row.company_id) ?? 0) + 1)
  }
  return map
}

async function assembleDeals(rows: DealRow[], stages: PipelineStage[]): Promise<Deal[]> {
  const stageById = new Map(stages.map((s) => [s.id, s]))
  const ownerMap = await profileNameMap(rows.map((r) => r.owner_id ?? ""))
  const companyMap = await companyNameMap(rows.map((r) => r.company_id ?? ""))
  const contactMap = await contactNameMap(rows.map((r) => r.contact_id ?? ""))
  return rows.map((r) => {
    const stage = stageById.get(r.stage_id)
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      title: r.title,
      amount: num(r.amount),
      currency: r.currency,
      stageId: r.stage_id,
      stageName: stage?.name ?? "Unknown",
      stageKind: stage?.kind ?? "open",
      probability: r.probability,
      expectedCloseDate: r.expected_close_date,
      closedAt: r.closed_at,
      contactId: r.contact_id,
      contactName: r.contact_id ? (contactMap.get(r.contact_id) ?? null) : null,
      companyId: r.company_id,
      companyName: r.company_id ? (companyMap.get(r.company_id) ?? null) : null,
      ownerId: r.owner_id,
      ownerName: r.owner_id ? (ownerMap.get(r.owner_id) ?? null) : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  })
}

async function assembleTasks(rows: TaskRowLite[]): Promise<Task[]> {
  const ownerMap = await profileNameMap(rows.map((r) => r.assignee_id ?? ""))
  const contactMap = await contactNameMap(rows.map((r) => r.contact_id ?? ""))
  const dealIds = rows.map((r) => r.deal_id ?? "").filter(Boolean)
  const dealMap = new Map<string, string>()
  if (dealIds.length > 0) {
    const { data } = await admin().from("deals").select("id, title").in("id", [...new Set(dealIds)])
    for (const row of (data ?? []) as { id: string; title: string }[]) dealMap.set(row.id, row.title)
  }
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    dueAt: r.due_at,
    assigneeId: r.assignee_id,
    assigneeName: r.assignee_id ? (ownerMap.get(r.assignee_id) ?? null) : null,
    contactId: r.contact_id,
    contactName: r.contact_id ? (contactMap.get(r.contact_id) ?? null) : null,
    dealId: r.deal_id,
    dealTitle: r.deal_id ? (dealMap.get(r.deal_id) ?? null) : null,
    createdByName: r.created_by ? (ownerMap.get(r.created_by) ?? null) : null,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  }))
}

async function assembleNotes(rows: NoteRowLite[]): Promise<Note[]> {
  const authorMap = await profileNameMap(rows.map((r) => r.author_id))
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    body: r.body,
    authorId: r.author_id,
    authorName: authorMap.get(r.author_id) ?? "Unknown",
    createdAt: r.created_at,
  }))
}

async function assertEntityExists(workspaceId: string, entityType: "contact" | "deal", entityId: string): Promise<void> {
  const table = entityType === "contact" ? "contacts" : "deals"
  const { count } = await admin()
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("id", entityId)
  if ((count ?? 0) === 0) {
    throw errors.notFound(entityType === "contact" ? "Contact not found" : "Deal not found")
  }
}

function toInvitationRow(row: InvitationRow): Invitation {
  const effectiveStatus =
    row.status === "pending" && new Date(row.expires_at).getTime() < Date.now() ? "expired" : row.status
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: effectiveStatus,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    invitedBy: row.invited_by ?? "A teammate",
  }
}

function camelPatch(input: { name?: string; baseCurrency?: string; timezone?: string }): Partial<WorkspaceRow> {
  const patch: Partial<WorkspaceRow> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.baseCurrency !== undefined) patch.base_currency = input.baseCurrency
  if (input.timezone !== undefined) patch.timezone = input.timezone
  return patch
}

function combine(entries: { currency: string; amount: number }[]): MoneyByCurrency[] {
  const map = new Map<string, number>()
  for (const e of entries) map.set(e.currency, (map.get(e.currency) ?? 0) + e.amount)
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => (a.currency === "INR" ? -1 : b.currency === "INR" ? 1 : a.currency.localeCompare(b.currency)))
}
