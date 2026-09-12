# NexusDesk — IT Service Management System

A full-featured, single-tenant ITSM platform covering **Ticket/Request Management**, **Asset Management**, **Task & Purchase Management**, with per-user customizable dashboards, SLA tracking, an approval workflow, audit trail, and role-based access control.

Built with **Next.js 16 (App Router)** · **Bun** · **PostgreSQL (Prisma)** · **Tailwind CSS** · shadcn-style UI · **Docker**.

---

## Features

### Core Modules
- **Tickets** — full lifecycle (Open → In Progress → Pending Approval → Resolved → Closed → Reopened), Impact × Urgency → Priority matrix (auto-suggest, override-able), public replies vs. private notes, technician assignment, closure codes, SLA due tracking.
- **Assets** — Hardware / Software / Consumable categories with category-conditional fields (serial number, license seats, stock quantity), CSV/XLSX import with per-row result reporting and email/employee-ID → department resolution, assignment with auto-notification.
- **Tasks** — Kanban board (To Do / In Progress / Done), checklists, optional linking to a parent ticket.
- **Purchases** — request → approval → completion workflow; on completion an Asset record is auto-generated with cost/vendor/date carried over.
- **Dashboard** — stat cards, recent tickets, my tasks; data scoped by RBAC.
- **Reports** — Ticket Volume, SLA Compliance %, Average Resolution Time, Asset Inventory, Technician Performance, Purchase Spend, with charts (Recharts) and export.

### Platform
- **Auth** — username/email + password (bcrypt), JWT in httpOnly cookie, enforced via a root `proxy.ts` (Next.js 16's renamed middleware). Default `admin`/`admin` is forced to change password on first login.
- **RBAC** — enforced at the API layer, not just hidden in the UI. Roles: SuperAdmin / User. User Types (multi): Requester, Technician, Approver, Auditor (read-only).
- **Audit Trail** — every Create/Update/Delete on Ticket/Asset/User/Task/Purchase/Settings is logged with actor, action, before/after diff, timestamp. Auditors get read-only access.
- **Notifications** — in-app bell + configurable event templates (SuperAdmin editable).
- **SuperAdmin settings** — ticket config (groups, statuses, priority matrix, closure codes), asset types/states, SLA + business hours, sites, notification templates, appearance branding, user management.
- **UX** — light/dark theme, collapsible responsive sidebar, mobile-friendly.

---

## Quick Start (Docker — recommended)

```bash
# from the project root
docker compose up --build
```

This starts the app (`:3000`), PostgreSQL, a one-shot `migrate` job that applies pending
migrations before the app boots, and a daily `pg_dump` backup sidecar.

Seed a fresh database once the stack is up:

```bash
docker compose run --rm migrate npx prisma db seed
```

Then open **http://localhost:3000** and sign in (the login screen's **Initialize Database**
button runs the same seed if you'd rather do it there):

```
Username: admin
Password: admin
```

You'll be prompted to set a new password (min 8 chars, letters + numbers).

---

## Local Development (Bun)

Prerequisites: [Bun](https://bun.sh) 1.3+, a running PostgreSQL 16+ on `localhost:5432`.

Create the role and database once:

```sql
CREATE ROLE nexusdesk LOGIN PASSWORD 'nexusdesk';
CREATE DATABASE nexusdesk OWNER nexusdesk;
-- Prisma needs a shadow database for `migrate dev`:
ALTER ROLE nexusdesk CREATEDB;
```

```bash
bun install
cp .env.example .env.local     # adjust DATABASE_URL / JWT_SECRET
bun run db:deploy              # apply migrations
bun run db:seed                # master data + admin/admin
bun run dev                    # http://localhost:3000
```

Production build:

```bash
bun run build
node .next/standalone/server.js   # standalone output; do NOT use `next start`
```

> The project uses `output: "standalone"`, so run the built server via `node .next/standalone/server.js` (with `public/` and `.next/static/` alongside it — the Dockerfile handles this).

---

## Database

The schema lives in [`prisma/schema.prisma`](prisma/schema.prisma) — 16 tables with real
foreign keys. The generated SQL under `prisma/migrations/` is the versioned,
auditable record of the structure; inspect it (or `psql \d+ <table>`) rather than
reading it back out of application code.

| Command             | What it does                                                        |
|---------------------|---------------------------------------------------------------------|
| `npm run db:migrate`| Create + apply a migration after editing `schema.prisma` (dev only) |
| `npm run db:deploy` | Apply pending migrations (production / CI)                          |
| `npm run db:seed`   | Insert master data and the initial `admin` account                  |
| `npm run db:reset`  | Drop, re-migrate, and re-seed — destroys all data                   |
| `npm test`          | Node's built-in test runner over `src/**/*.test.ts`                 |

`npx prisma studio` opens a browser table viewer.

---

## Environment Variables

| Variable       | Description                          | Default                                                     |
|----------------|--------------------------------------|-------------------------------------------------------------|
| `DATABASE_URL` | PostgreSQL connection string         | `postgresql://nexusdesk:nexusdesk@127.0.0.1:5432/nexusdesk` |
| `JWT_SECRET`   | Secret for signing session JWTs      | (change in production)                                      |
| `NODE_ENV`     | `development` / `production`         | `development`                                               |

---

## First-Run Seed

The seed (via **Initialize Database** button, `POST /api/seed`, or `npm run db:seed` — all
run the same code in `src/lib/seed.ts`) creates:
- The default `admin` SuperAdmin (force-change password).
- Master data: ticket statuses/groups/closure codes, request types, impacts/urgencies, priority matrix, asset types/states, user types, a default SLA, a Headquarters site, notification templates, and app appearance.

Seeding is idempotent — it no-ops if an `admin` user already exists. `POST /api/seed`
with `{"force": true}` truncates every application table and re-seeds; it requires a
SuperAdmin session (or an `x-seed-force-secret` header matching `SEED_FORCE_SECRET`)
once any user exists.

---

## Asset Import

Download the header template at `/Templates/asset-import-template.csv`. Required columns: `name`, `assetType`, `assetTag` (unique key for insert-vs-update). `Department` is **not** free-text — it's resolved from the `assignedToEmail` or `assignedToEmployeeId` lookup. Import returns a per-row report (created / updated / failed + reason).

Other static templates live under `public/Templates/` (user, department, asset). Default brand logo is `public/Images/default.png`; uploaded logos go to `public/Images/Uploads/Brand/`.

---

## Tech Notes

- **Next.js 16** renames `middleware.ts` → `proxy.ts` and removes the `eslint`/`next lint` config option — both handled here.
- **Docker builds with Node (npm), not Bun**, so the platform-specific native binaries for `@next/swc` and tailwind oxide resolve for linux/musl. Local dev/build with Bun is fine.
- API route handlers are marked `export const dynamic = "force-dynamic"` + `runtime = "nodejs"` (they hit the database, never static). `@prisma/client`, `@prisma/adapter-pg`, and `bcryptjs` are `serverExternalPackages` so Next doesn't bundle them.
- RBAC is enforced in each API route and the `proxy.ts` gate; UI hiding is secondary.
- One `PrismaClient` is reused across hot reloads via the global singleton in `src/lib/db.ts`, so recompiles don't open new connection pools.
- The database column is `id`; API responses also carry `_id` as an alias (`src/lib/serialize.ts`) so the UI and JWT payload keep one shape. `Json` columns are passed through untouched — a key named `id` inside `settings.value` or an audit `before`/`after` snapshot is real data, not a primary key.
- Structured API responses: `{ success, data, error?, pagination? }`.

---

## Project Structure

```
prisma/
  schema.prisma         # tables, relations, foreign keys — the schema of record
  migrations/           # versioned SQL, the auditable change history
  seed.ts               # `prisma db seed` entry point
src/
  app/
    (dashboard)/        # authenticated app shell + module pages
      tickets/ assets/ tasks/ purchases/ reports/ notifications/ profile/
      admin/            # SuperAdmin settings + audit trail
    api/                # REST route handlers
    login/  change-password/
    layout.tsx  globals.css
  components/
    ui/                 # shadcn-style primitives
    layout/             # sidebar, topbar, app shell
    providers/          # auth + theme
  generated/prisma/     # generated client (gitignored, rebuilt on install)
  lib/
    db.ts               # PrismaClient singleton
    serialize.ts        # `_id` alias for API responses
    prisma-errors.ts    # unique / foreign-key violation helpers
    auth.ts audit.ts seed.ts utils.ts
  proxy.ts              # Next.js 16 middleware (auth gate)
```

---

## Deployment

- `docker compose up --build -d` for production.
- Set a strong `JWT_SECRET` and `POSTGRES_PASSWORD` via environment (compose reads `${JWT_SECRET}` / `${POSTGRES_PASSWORD}`). `POSTGRES_PORT` overrides the host-side port if 5432 is already in use.
- The `migrate` service runs `prisma migrate deploy` and must exit successfully before the app starts, so a schema change ships with the image. It is built from the Dockerfile's `builder` stage because the Prisma CLI needs the full `node_modules`.
- PostgreSQL's published port is bound to `127.0.0.1` — reachable for local `psql` / `pg_dump`, not exposed to the LAN. The app connects over the compose network.
- The `postgres-backup` service runs a daily `pg_dump -Fc` into `./backups`, pruning dumps older than 7 days. Restore with `pg_restore -d nexusdesk <file>`.
- Attachment size limit (default 10 MB) and allowed types are configurable in Settings.
