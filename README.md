# NexusDesk — IT Service Management System

A full-featured, single-tenant ITSM platform covering **Ticket/Request Management**, **Asset Management**, **Task & Purchase Management**, with per-user customizable dashboards, SLA tracking, an approval workflow, audit trail, and role-based access control.

Built with **Next.js 16 (App Router)** · **Bun** · **MongoDB (Mongoose)** · **Tailwind CSS** · shadcn-style UI · **Docker**.

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

This starts three services: the app (`:3000`), MongoDB (`:27017`), and a daily `mongodump` backup sidecar.

Then open **http://localhost:3000**, click **Initialize Database** on the login screen (one-time seed), and sign in:

```
Username: admin
Password: admin
```

You'll be prompted to set a new password (min 8 chars, letters + numbers).

---

## Local Development (Bun)

Prerequisites: [Bun](https://bun.sh) 1.3+, a running MongoDB on `localhost:27017`.

```bash
bun install
cp .env.example .env.local     # adjust MONGODB_URI / JWT_SECRET
bun run dev                    # http://localhost:3000
```

Production build:

```bash
bun run build
node .next/standalone/server.js   # standalone output; do NOT use `next start`
```

> The project uses `output: "standalone"`, so run the built server via `node .next/standalone/server.js` (with `public/` and `.next/static/` alongside it — the Dockerfile handles this).

---

## Environment Variables

| Variable      | Description                          | Default                                  |
|---------------|--------------------------------------|------------------------------------------|
| `MONGODB_URI` | MongoDB connection string            | `mongodb://localhost:27017/nexusdesk`    |
| `JWT_SECRET`  | Secret for signing session JWTs      | (change in production)                   |
| `NODE_ENV`    | `development` / `production`         | `development`                            |

---

## First-Run Seed

The seed (via **Initialize Database** button or `POST /api/seed`) creates:
- The default `admin` SuperAdmin (force-change password).
- Master data: ticket statuses/groups/closure codes, request types, impacts/urgencies, priority matrix, asset types/states, user types, a default SLA, a Headquarters site, notification templates, and app appearance.

Seeding is idempotent — it no-ops if an `admin` user already exists.

---

## Asset Import

Download the header template at `/Templates/asset-import-template.csv`. Required columns: `name`, `assetType`, `assetTag` (unique key for insert-vs-update). `Department` is **not** free-text — it's resolved from the `assignedToEmail` or `assignedToEmployeeId` lookup. Import returns a per-row report (created / updated / failed + reason).

Other static templates live under `public/Templates/` (user, department, asset). Default brand logo is `public/Images/default.png`; uploaded logos go to `public/Images/Uploads/Brand/`.

---

## Tech Notes

- **Next.js 16** renames `middleware.ts` → `proxy.ts` and removes the `eslint`/`next lint` config option — both handled here.
- **Docker builds with Node (npm), not Bun.** Bun 1.3's runtime doesn't implement `node:v8.isBuildingSnapshot`, which Mongoose touches during Next's "collect page data" build phase — so the container build stage uses `node:22-alpine`. Local dev/build with Bun is fine.
- API route handlers are marked `export const dynamic = "force-dynamic"` + `runtime = "nodejs"` (they hit MongoDB, never static). Mongoose/bcryptjs are `serverExternalPackages` so Next doesn't bundle them.
- RBAC is enforced in each API route and the `proxy.ts` gate; UI hiding is secondary.
- Mongoose models are cached across hot reloads via the global connection pattern in `src/lib/db.ts`.
- Structured API responses: `{ success, data, error?, pagination? }`.

---

## Project Structure

```
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
  lib/
    models/             # Mongoose schemas
    db.ts auth.ts api-middleware.ts audit.ts seed.ts utils.ts
  proxy.ts              # Next.js 16 middleware (auth gate)
```

---

## Deployment

- `docker compose up --build -d` for production.
- Set a strong `JWT_SECRET` via environment (compose reads `${JWT_SECRET}`).
- The `mongo-backup` service runs a daily gzip `mongodump` into `./backups`, pruning archives older than 7 days.
- Attachment size limit (default 10 MB) and allowed types are configurable in Settings.
