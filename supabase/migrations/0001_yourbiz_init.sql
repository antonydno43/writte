-- ============================================================================
-- YourBiz CRM — initial database schema (v1)
-- ----------------------------------------------------------------------------
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → paste →
-- Run). It creates every table, relationship, trigger and Row-Level Security
-- policy the app needs.
--
-- Security model:
--   * Every table has RLS ENABLED.
--   * Anonymous API keys see NOTHING (no select policies for anon).
--   * Authenticated users only see rows belonging to workspaces they are a
--     member of, enforced by Postgres itself (not just the app).
--   * The app's API routes use the service-role key AFTER verifying
--     membership + role, so RLS is a second line of defence.
--   * Workspace admin/owner-only operations (settings, members, invitations,
--     pipeline stages) are additionally restricted at the policy level.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================== helper functions ============================

-- Is the calling user a member of this workspace? (used by every policy)
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
  );
$$;

-- Does the calling user have one of these roles in this workspace?
create or replace function public.has_workspace_role(ws uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and m.role = any (roles)
  );
$$;

-- Does a user account with this email exist? (used by the app's invite flow)
create or replace function public.user_email_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users u
    where lower(u.email) = lower(p_email)
  );
$$;

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ================================ profiles ==================================
-- One row per auth user: display name, timezone and display currency.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  timezone text not null default 'UTC',
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile whenever a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, timezone, currency)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC'),
    coalesce(new.raw_user_meta_data ->> 'currency', 'INR')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

-- =============================== workspaces =================================
-- A workspace (tenant). Everything else hangs off workspace_id.

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  base_currency text not null default 'INR',
  timezone text not null default 'UTC',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workspaces_touch_updated_at
  before update on public.workspaces
  for each row execute procedure public.touch_updated_at();

alter table public.workspaces enable row level security;

create policy "workspaces_select_members" on public.workspaces
  for select using (public.is_workspace_member(id));

create policy "workspaces_update_admins" on public.workspaces
  for update using (public.has_workspace_role(id, array['owner','admin']))
  with check (public.has_workspace_role(id, array['owner','admin']));

-- (insert/delete happen only through the service role — no client policies.)

-- ============================ workspace_members ==============================
-- Who belongs to which workspace, and with which role.

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_workspace_idx on public.workspace_members (workspace_id);
create index workspace_members_user_idx on public.workspace_members (user_id);

alter table public.workspace_members enable row level security;

create policy "members_select_ws_members" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

-- Only owner/admin can change roles, and the owner row can never be touched.
create policy "members_update_admins" on public.workspace_members
  for update using (
    public.has_workspace_role(workspace_id, array['owner','admin'])
    and role <> 'owner'
  )
  with check (
    public.has_workspace_role(workspace_id, array['owner','admin'])
    and role <> 'owner'
  );

create policy "members_delete_admins" on public.workspace_members
  for delete using (
    public.has_workspace_role(workspace_id, array['owner','admin'])
    and role <> 'owner'
  );

-- (inserts happen only through the service role — no client policy.)

-- ================================ invitations ================================
-- Email invitations with secure single-purpose tokens.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin','member')),
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz
);

create index invitations_workspace_idx on public.invitations (workspace_id);
create index invitations_token_idx on public.invitations (token);

alter table public.invitations enable row level security;

-- Only workspace admins can even see invitations via the API.
create policy "invitations_select_admins" on public.invitations
  for select using (public.has_workspace_role(workspace_id, array['owner','admin']));

-- (insert/update/delete happen only through the service role.)

-- ============================== pipeline_stages ==============================

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  position integer not null default 0,
  kind text not null default 'open' check (kind in ('open','won','lost')),
  unique (workspace_id, name),
  unique (workspace_id, position)
);

create index pipeline_stages_workspace_idx on public.pipeline_stages (workspace_id);

alter table public.pipeline_stages enable row level security;

create policy "stages_select_members" on public.pipeline_stages
  for select using (public.is_workspace_member(workspace_id));

create policy "stages_update_admins" on public.pipeline_stages
  for update using (public.has_workspace_role(workspace_id, array['owner','admin']));

create policy "stages_delete_admins" on public.pipeline_stages
  for delete using (public.has_workspace_role(workspace_id, array['owner','admin']));

-- ================================ companies =================================

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  domain text,
  industry text,
  phone text,
  city text,
  state text,
  country text,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companies_workspace_idx on public.companies (workspace_id);
create index companies_owner_idx on public.companies (owner_id);
create index companies_name_idx on public.companies (workspace_id, name);

create trigger companies_touch_updated_at
  before update on public.companies
  for each row execute procedure public.touch_updated_at();

alter table public.companies enable row level security;

create policy "companies_select_members" on public.companies
  for select using (public.is_workspace_member(workspace_id));
create policy "companies_insert_members" on public.companies
  for insert with check (public.is_workspace_member(workspace_id));
create policy "companies_update_members" on public.companies
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "companies_delete_members" on public.companies
  for delete using (public.is_workspace_member(workspace_id));

-- ================================ contacts ==================================

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 60),
  last_name text not null default '' check (char_length(last_name) <= 60),
  email text,
  phone text,
  job_title text,
  status text not null default 'lead'
    check (status in ('lead','contacted','qualified','customer','lost')),
  company_id uuid references public.companies (id) on delete set null,
  owner_id uuid references auth.users (id) on delete set null,
  city text,
  state text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_workspace_idx on public.contacts (workspace_id);
create index contacts_owner_idx on public.contacts (owner_id);
create index contacts_company_idx on public.contacts (company_id);
create index contacts_search_idx on public.contacts
  using gin (to_tsvector('simple', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,'')));
create index contacts_updated_idx on public.contacts (workspace_id, updated_at desc);

create trigger contacts_touch_updated_at
  before update on public.contacts
  for each row execute procedure public.touch_updated_at();

alter table public.contacts enable row level security;

create policy "contacts_select_members" on public.contacts
  for select using (public.is_workspace_member(workspace_id));
create policy "contacts_insert_members" on public.contacts
  for insert with check (public.is_workspace_member(workspace_id));
create policy "contacts_update_members" on public.contacts
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "contacts_delete_members" on public.contacts
  for delete using (public.is_workspace_member(workspace_id));

-- ================================== deals ====================================

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  amount numeric(14,2) not null default 0,
  currency text not null default 'INR',
  stage_id uuid references public.pipeline_stages (id) on delete restrict,
  probability integer not null default 50 check (probability between 0 and 100),
  expected_close_date date,
  closed_at timestamptz,
  contact_id uuid references public.contacts (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_workspace_idx on public.deals (workspace_id);
create index deals_stage_idx on public.deals (stage_id);
create index deals_contact_idx on public.deals (contact_id);
create index deals_owner_idx on public.deals (owner_id);
create index deals_updated_idx on public.deals (workspace_id, updated_at desc);
create index deals_closed_idx on public.deals (workspace_id, closed_at desc);

create trigger deals_touch_updated_at
  before update on public.deals
  for each row execute procedure public.touch_updated_at();

alter table public.deals enable row level security;

create policy "deals_select_members" on public.deals
  for select using (public.is_workspace_member(workspace_id));
create policy "deals_insert_members" on public.deals
  for insert with check (public.is_workspace_member(workspace_id));
create policy "deals_update_members" on public.deals
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "deals_delete_members" on public.deals
  for delete using (public.is_workspace_member(workspace_id));

-- ================================== tasks ====================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  description text,
  status text not null default 'open' check (status in ('open','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_at timestamptz,
  assignee_id uuid references auth.users (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  deal_id uuid references public.deals (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index tasks_workspace_idx on public.tasks (workspace_id);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_contact_idx on public.tasks (contact_id);
create index tasks_deal_idx on public.tasks (deal_id);
create index tasks_status_idx on public.tasks (workspace_id, status);

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute procedure public.touch_updated_at();

alter table public.tasks enable row level security;

create policy "tasks_select_members" on public.tasks
  for select using (public.is_workspace_member(workspace_id));
create policy "tasks_insert_members" on public.tasks
  for insert with check (public.is_workspace_member(workspace_id));
create policy "tasks_update_members" on public.tasks
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy "tasks_delete_members" on public.tasks
  for delete using (public.is_workspace_member(workspace_id));

-- ================================== notes ====================================

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entity_type text not null check (entity_type in ('contact','deal')),
  entity_id uuid not null,
  body text not null check (char_length(body) between 1 and 2000),
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index notes_entity_idx on public.notes (entity_type, entity_id);
create index notes_workspace_idx on public.notes (workspace_id);

alter table public.notes enable row level security;

create policy "notes_select_members" on public.notes
  for select using (public.is_workspace_member(workspace_id));
create policy "notes_insert_members" on public.notes
  for insert with check (public.is_workspace_member(workspace_id));
create policy "notes_delete_members" on public.notes
  for delete using (public.is_workspace_member(workspace_id));

-- ============================================================================
-- Done. Next steps (README.md has the full walkthrough):
--   1. Copy Project URL + anon key + service_role key into Vercel env vars.
--   2. Optional but recommended: Auth → Providers → Email → disable "Confirm
--      email" OR keep it on (the app sends its own branded confirmation email
--      through Resend when RESEND_API_KEY is set).
-- ============================================================================
