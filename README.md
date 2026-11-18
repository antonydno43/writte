# YourBiz CRM

Simple, powerful CRM for growing businesses — made for India, built for the world.

YourBiz CRM keeps your **contacts, companies, deals, tasks and team** in one calm workspace:

- **Drag-and-drop deal pipeline** (Kanban) with custom stages, Won/Lost tracking and win probability
- **Multi-currency deals** — 33 currencies with Indian-style formatting (₹12,50,000), per-deal currency, approximate workspace totals
- **Multi-timezone collaboration** — every teammate sees every date and deadline in *their own* timezone; nothing clashes between Chennai, Dubai and New York
- **Multi-workspace accounts** — every user can own several workspaces and switch between them; invited teammates can also keep their own separate workspaces
- **Email invitations** (Resend) — invite by email even if the person has no account; they get a friendly link, create their account, and land inside your workspace
- **Bank-grade isolation** — every table protected by Postgres Row-Level Security; workspaces physically cannot read each other's rows
- **Works beautifully on phones** — responsive from 360px up, touch-friendly drag, bottom navigation

---

## Tech stack

| Layer     | Technology                                             |
|-----------|--------------------------------------------------------|
| Framework | Next.js 16 (App Router) + TypeScript 5                 |
| UI        | Tailwind CSS 4, shadcn/ui (New York), Lucide icons     |
| Database  | Supabase Postgres + Supabase Auth (RLS enforced)       |
| Email     | Resend                                                 |
| Hosting   | Vercel                                                 |

---

## Local development (zero setup)

```bash
bun install        # or npm install
bun run dev        # or npm run dev
```

That's it — **no environment variables needed locally**. Without Supabase variables
the app runs on a built-in in-memory backend that persists to `db/dev-store.json`
while the dev server runs. It starts completely empty (no demo data) — create your
own account and try everything.

> The in-memory backend is for development only. Production always uses Supabase
> (whenever the three Supabase env vars below are present, the app switches to it
> automatically — same code, same features).

---

## Production setup (step by step)

You will do three things: **run one SQL migration**, **get a Resend API key**, and
**connect the repo to Vercel with 6 environment variables**.

### Step 1 — Create the database (Supabase)

1. Go to [supabase.com](https://supabase.com) → **New project** (any name, strong DB password, choose the region closest to your customers).
2. In the project, open **SQL Editor → New query**.
3. Open `supabase/migrations/0001_yourbiz_init.sql` from this repo, **copy everything**, paste it into the editor, and click **Run**.
   - This creates all tables, relationships, triggers and **Row-Level Security policies**.
4. (Optional but recommended) **Authentication → Providers → Email**: you can leave "Confirm email" ON — when `RESEND_API_KEY` is set (Step 2) the app sends its own branded confirmation email. If you turn it OFF, sign-up logs users in instantly.
5. Keep the dashboard open — you'll copy three keys in Step 3.

### Step 2 — Email sending (Resend)

1. Create a free account at [resend.com](https://resend.com) → **API Keys → Create API Key** (full access) → copy it.
2. **Testing:** you can send immediately from Resend's shared address, but it only delivers to your own Resend account email.
3. **Production:** verify your domain in Resend (Domains → Add) so you can email *any* user. Add the SPF/DKIM records Resend shows you. This step is what keeps your emails out of spam folders — do it before you invite real customers.

### Step 3 — Deploy on Vercel

1. Push/import this repository into Vercel (**Add New → Project → import the GitHub repo**). Framework preset: **Next.js** — no build settings need changing.
2. In **Project → Settings → Environment Variables**, add these (all environments):

| Name | Where to get it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → *Project URL* | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → keys → *anon / public* | Safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → keys → *service_role* | **Server-only secret.** Bypasses RLS — the app's API routes double-check membership before every privileged write |
| `RESEND_API_KEY` | Resend → API Keys | Sends sign-up & invitation emails |
| `EMAIL_FROM` | You choose | e.g. `YourBiz CRM <no-reply@yourdomain.com>` (verified domain). For testing only: `YourBiz CRM <onboarding@resend.dev>` |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL or custom domain | Used inside email links, e.g. `https://yourbiz-crm.vercel.app` |

3. Click **Deploy**. First deploy takes ~1–2 minutes.
4. Test the golden path: **Sign up → create a workspace → add a contact → create a deal → drag it to Won → invite a teammate by email → have them accept**. Also check the Resend dashboard (Delivery tab) to confirm the emails were sent.

#### Common deployment checks

| Symptom | Fix |
|---|---|
| Sign-up says "Supabase is not configured" | One of the three Supabase vars is missing or has a typo — redeploy after fixing |
| Emails never arrive | Check `RESEND_API_KEY` and `EMAIL_FROM`. With the shared `onboarding@resend.dev` address, Resend only delivers to your own account email. Verify a domain to send to anyone |
| Invitation link points at localhost | `NEXT_PUBLIC_APP_URL` is missing — set it to your deployed URL |
| "Please confirm your email" on sign-in | Expected when email confirmation is ON — the user must click the link in the email first (or disable confirmation per Step 1.4) |
| Redirect loop after sign-in | Ensure `NEXT_PUBLIC_APP_URL` matches the exact domain you're visiting (https, no trailing slash) |

---

## Security model (what protects your customers' data)

1. **Row-Level Security on every table.** Policies call `is_workspace_member(workspace_id)` — enforced by Postgres itself. An anonymous API key reads *nothing*; an authenticated user reads *only* their workspaces' rows.
2. **Owner/admin-only policies** for workspace settings, members, invitations and pipeline stages (`has_workspace_role(..., ARRAY['owner','admin'])`), with the owner row untouchable.
3. **Service-role key stays server-side** (API routes only) and every privileged operation re-verifies session → membership → role before writing.
4. **Invitation tokens** are unguessable UUIDs, expire after 7 days, and can be revoked; accepting requires the invited email to match the signed-in account.
5. **Sessions** are httpOnly cookies (Supabase Auth in production; HMAC-signed cookie locally).
6. Profiles store only name, timezone and display currency — no sensitive data beyond what the CRM needs.

> After your first deploy, also enable **MFA on your Supabase and Vercel accounts** — the admin seats of your business.

---

## Project structure

```
src/
  app/
    page.tsx                  Landing page (marketing)
    login/  signup/            Auth pages
    invite/[token]/           Invitation accept page
    onboarding/               Create your first (or a new) workspace
    (app)/                    The signed-in app shell
      dashboard/ contacts/ companies/ deals/ tasks/ team/ settings/
    api/                      ~25 API routes (auth, workspaces, contacts,
                              companies, deals, tasks, notes, dashboard,
                              team, invitations, stages)
  lib/
    backend/                  Two interchangeable backends behind one contract:
      local.ts                in-memory dev backend (no env needed)
      supabase.ts             production Supabase backend
    i18n.ts                   currencies, timezones, money/date formatting, FX
    email.ts                  Resend templates (welcome, verify, invite)
    types.ts                  shared domain types
supabase/migrations/0001_yourbiz_init.sql   the SQL you run once
```

---

## Monetization path (ready for billing later)

Pricing tiers are already on the landing page (Starter ₹0 · Growth ₹899/user/mo ·
Scale ₹2,399/user/mo with USD display). When you're ready to charge, wire Stripe
Checkout + a `plan` column on `workspaces` and gate the Growth/Scale features —
the workspace model makes per-seat enforcement trivial. Until then, everything
runs free ("early access").

## Roadmap ideas after launch

CSV import/export · saved filters · workflows & email sequences · custom fields ·
Stripe billing · Google AI integration (planned once you cross ~500 active users,
as you intended) · mobile PWA offline mode.

---

© YourBiz CRM. Made for India, built for the world.
