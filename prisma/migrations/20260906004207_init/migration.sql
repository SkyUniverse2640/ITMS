-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('SuperAdmin', 'User');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('Active', 'Inactive');

-- CreateEnum
CREATE TYPE "asset_category" AS ENUM ('Hardware', 'Software', 'Consumable');

-- CreateEnum
CREATE TYPE "approval_status" AS ENUM ('Pending', 'Approved', 'Rejected');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('Create', 'Update', 'Delete');

-- CreateEnum
CREATE TYPE "audit_module" AS ENUM ('Ticket', 'Asset', 'User', 'Task', 'Purchase', 'Settings');

-- CreateEnum
CREATE TYPE "import_type" AS ENUM ('users', 'assets', 'departments');

-- CreateEnum
CREATE TYPE "dashboard_scope" AS ENUM ('system', 'user');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'User',
    "user_types" TEXT[],
    "job_title" TEXT,
    "department" TEXT,
    "employee_id" TEXT NOT NULL,
    "mobile" TEXT,
    "email" TEXT NOT NULL,
    "site_id" TEXT,
    "status" "user_status" NOT NULL DEFAULT 'Active',
    "last_login" TIMESTAMP(3),
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "default_dashboard_key" TEXT DEFAULT 'general',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL,
    "business_hours" JSONB NOT NULL,
    "holidays" TEXT[],
    "escalation" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "dashboard_scope" NOT NULL DEFAULT 'user',
    "audience" TEXT NOT NULL DEFAULT 'all',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_system_favorite" BOOLEAN NOT NULL DEFAULT false,
    "widgets" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sub_category" TEXT,
    "description" TEXT,
    "need_approval" BOOLEAN NOT NULL DEFAULT false,
    "default_fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL,
    "asset_category" "asset_category" NOT NULL,
    "asset_tag" TEXT NOT NULL,
    "serial_number" TEXT,
    "vendor" TEXT,
    "purchase_cost" DOUBLE PRECISION,
    "purchase_date" TIMESTAMP(3),
    "expired_date" TIMESTAMP(3),
    "warranty_expired_date" TIMESTAMP(3),
    "current_state" TEXT NOT NULL DEFAULT 'In Warehouse',
    "assigned_to_id" TEXT,
    "department" TEXT,
    "site_id" TEXT,
    "comment" TEXT,
    "license_key" TEXT,
    "total_seats" INTEGER,
    "seats_used" INTEGER DEFAULT 0,
    "stock_quantity" INTEGER,
    "reorder_threshold" INTEGER,
    "unit" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "request_type" TEXT NOT NULL DEFAULT 'Incident',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "impact" TEXT NOT NULL DEFAULT 'Normal',
    "urgency" TEXT NOT NULL DEFAULT 'Normal',
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "group" TEXT NOT NULL DEFAULT 'IT',
    "department" TEXT DEFAULT 'IT',
    "category" TEXT,
    "sub_category" TEXT,
    "project" TEXT,
    "requester_id" TEXT NOT NULL,
    "requester_name" TEXT NOT NULL,
    "requester_email" TEXT NOT NULL,
    "technician_id" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "attachments" TEXT[],
    "approver_id" TEXT,
    "approval_label" TEXT,
    "approval_status" "approval_status",
    "closure_code" TEXT,
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "reopened_at" TIMESTAMP(3),
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "sla_due_at" TIMESTAMP(3),
    "sla_respond_due_at" TIMESTAMP(3),
    "sla_respond_breached" BOOLEAN NOT NULL DEFAULT false,
    "sla_responded_at" TIMESTAMP(3),
    "sla_config_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_comments" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "attachments" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_logs" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_assets" (
    "ticket_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,

    CONSTRAINT "ticket_assets_pkey" PRIMARY KEY ("ticket_id","asset_id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "related_ticket_id" TEXT,
    "assignee_id" TEXT NOT NULL,
    "date_start" TIMESTAMP(3),
    "date_end" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'To Do',
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "linked_asset_type" TEXT,
    "quantity" INTEGER NOT NULL,
    "estimated_cost" DOUBLE PRECISION NOT NULL,
    "vendor" TEXT,
    "justification" TEXT,
    "requested_by_id" TEXT NOT NULL,
    "approver_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "rejection_reason" TEXT,
    "linked_asset_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "action" "audit_action" NOT NULL,
    "module" "audit_module" NOT NULL,
    "target_id" TEXT NOT NULL,
    "target_label" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_history" (
    "id" TEXT NOT NULL,
    "type" "import_type" NOT NULL,
    "file_name" TEXT NOT NULL,
    "imported_by_id" TEXT,
    "imported_by_name" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "failures" JSONB NOT NULL DEFAULT '[]',
    "results" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sites_name_key" ON "sites"("name");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "dashboards_key_key" ON "dashboards"("key");

-- CreateIndex
CREATE INDEX "dashboards_user_id_idx" ON "dashboards"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_asset_tag_key" ON "assets"("asset_tag");

-- CreateIndex
CREATE INDEX "assets_assigned_to_id_idx" ON "assets"("assigned_to_id");

-- CreateIndex
CREATE INDEX "assets_current_state_idx" ON "assets"("current_state");

-- CreateIndex
CREATE INDEX "assets_asset_category_idx" ON "assets"("asset_category");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "tickets_requester_id_idx" ON "tickets"("requester_id");

-- CreateIndex
CREATE INDEX "tickets_technician_id_idx" ON "tickets"("technician_id");

-- CreateIndex
CREATE INDEX "tickets_approver_id_idx" ON "tickets"("approver_id");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_priority_idx" ON "tickets"("priority");

-- CreateIndex
CREATE INDEX "tickets_created_at_idx" ON "tickets"("created_at" DESC);

-- CreateIndex
CREATE INDEX "ticket_comments_ticket_id_created_at_idx" ON "ticket_comments"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_comments_author_id_idx" ON "ticket_comments"("author_id");

-- CreateIndex
CREATE INDEX "ticket_logs_ticket_id_created_at_idx" ON "ticket_logs"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_assets_asset_id_idx" ON "ticket_assets"("asset_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_status_idx" ON "tasks"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "tasks_related_ticket_id_idx" ON "tasks"("related_ticket_id");

-- CreateIndex
CREATE INDEX "purchases_requested_by_id_idx" ON "purchases"("requested_by_id");

-- CreateIndex
CREATE INDEX "purchases_approver_id_status_idx" ON "purchases"("approver_id", "status");

-- CreateIndex
CREATE INDEX "purchases_status_idx" ON "purchases"("status");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_read_created_at_idx" ON "notifications"("recipient_id", "read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_module_action_idx" ON "audit_logs"("module", "action");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "import_history_type_created_at_idx" ON "import_history"("type", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sla_config_id_fkey" FOREIGN KEY ("sla_config_id") REFERENCES "slas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_logs" ADD CONSTRAINT "ticket_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_logs" ADD CONSTRAINT "ticket_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assets" ADD CONSTRAINT "ticket_assets_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assets" ADD CONSTRAINT "ticket_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_related_ticket_id_fkey" FOREIGN KEY ("related_ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_linked_asset_id_fkey" FOREIGN KEY ("linked_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_history" ADD CONSTRAINT "import_history_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
