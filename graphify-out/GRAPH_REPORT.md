# Graph Report - .  (2026-07-19)

## Corpus Check
- 153 files · ~96,404 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 910 nodes · 2642 edges · 86 communities (37 shown, 49 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Spreadsheet Import/Export & Templates
- Brand & Theming System
- Ticket Core & Settings
- Config Constants & Asset Enums
- Asset & Resource APIs
- Purchases, Profile & Notifications
- Notifications, Ack & Nav-Access Admin
- Build & Dev Tooling
- Appearance & Asset Admin UI
- TypeScript Config
- Onboarding & User Model
- Detail Views & UI Buttons
- ITSM Domain Concepts (PRD)
- Dashboard Pages & Layout
- Shared Type Definitions
- Navigation & Access Control
- Tasks & Ticket Metadata
- Notification Dispatch
- App Shell & Sidebar
- Database & Asset Models
- Session & JWT Auth
- Import Flow & Onboarding
- Table Columns & Roles UI
- Settings & Dashboard Schema
- Runtime Dependencies
- Departments & Import History
- Dashboard Configuration
- User Management API
- Department Roles
- Preferences & Notification Sound
- Preferences Provider
- Audit Log Model
- Category Migration Script
- Auth Proxy Middleware
- SLA & Escalation Concepts
- Request Types Patch Script
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84

## God Nodes (most connected - your core abstractions)
1. `connectDB()` - 91 edges
2. `getSession()` - 79 edges
3. `cn()` - 64 edges
4. `useToast()` - 49 edges
5. `createAuditLog()` - 39 edges
6. `useAuth()` - 37 edges
7. `Button` - 34 edges
8. `Card` - 31 edges
9. `CardContent` - 31 edges
10. `CardHeader` - 27 edges

## Surprising Connections (you probably didn't know these)
- `Role vs User Type Separation` --semantically_similar_to--> `API-Layer RBAC Enforcement`  [INFERRED] [semantically similar]
  context.md → README.md
- `ResizableDataTable()` --indirect_call--> `row()`  [INFERRED]
  src/components/ui/resizable-data-table.tsx → scripts/write-templates.mjs
- `parseSpreadsheetFile()` --indirect_call--> `row()`  [INFERRED]
  src/lib/parse-spreadsheet.ts → scripts/write-templates.mjs
- `GET()` --references--> `asset`  [EXTRACTED]
  src/app/api/dashboard/widgets/route.ts → scripts/write-templates.mjs
- `GET()` --references--> `asset`  [EXTRACTED]
  src/app/api/reports/route.ts → scripts/write-templates.mjs

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **NexusDesk Docker Compose Stack** — docker_compose_app, docker_compose_mongo, docker_compose_mongo_backup, docker_compose_nexusdesk_network [EXTRACTED 1.00]
- **Functional User Type Classification** — context_requester, context_technician, context_approver, context_auditor [EXTRACTED 0.95]
- **SLA Tracking and Escalation Flow** — context_sla_business_hours, context_escalation_matrix, context_notification_system, context_priority_matrix [INFERRED 0.85]

## Communities (86 total, 49 thin omitted)

### Community 0 - "Spreadsheet Import/Export & Templates"
Cohesion: 0.06
Nodes (59): RFC-4180, react, xlsx, react, cell(), department, dir, files (+51 more)

### Community 1 - "Brand & Theming System"
Cohesion: 0.06
Nodes (54): GET(), MIME, GET(), FONT_ALLOWED, fontFamilyFromFilename(), getExt(), IMAGE_ALLOWED, isAllowedFontMagic() (+46 more)

### Community 2 - "Ticket Core & Settings"
Cohesion: 0.07
Nodes (41): GET(), PUT(), refId(), formatDuration(), TicketSettingsPage(), TicketDetailPage(), CommentSchema, IComment (+33 more)

### Community 3 - "Config Constants & Asset Enums"
Cohesion: 0.10
Nodes (35): AssetState, AssetType, CATEGORIES, TYPES, ACTION_COLORS, AuditRow, ColId, DEFAULT_COLUMNS (+27 more)

### Community 4 - "Asset & Resource APIs"
Cohesion: 0.14
Nodes (34): asset, DELETE(), GET(), PUT(), POST(), GET(), POST(), DELETE() (+26 more)

### Community 5 - "Purchases, Profile & Notifications"
Cohesion: 0.09
Nodes (29): AuditTrailPage(), NotificationsPage(), ProfilePage(), ASSET_TYPES, EMPTY_FORM, PopulatedAsset, PopulatedUser, PURCHASE_STATUS_COLORS (+21 more)

### Community 6 - "Notifications, Ack & Nav-Access Admin"
Cohesion: 0.09
Nodes (27): AcknowledgmentPage(), AckSettings, AssetSettingsPage(), ALL_TYPES, NavAccessPage(), DEFAULT_SMTP, EVENT_LABELS, NotifEvent (+19 more)

### Community 7 - "Build & Dev Tooling"
Cohesion: 0.07
Nodes (29): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+21 more)

### Community 8 - "Appearance & Asset Admin UI"
Cohesion: 0.18
Nodes (18): Appearance, FONT_EXT, IMAGE_EXT, UserOption, AssetRow, CAT_META, NamedItem, TicketTemplate (+10 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 10 - "Onboarding & User Model"
Cohesion: 0.11
Nodes (22): genId(), POST(), computeReadiness(), GET(), POST(), POST(), IUser, UserSchema (+14 more)

### Community 11 - "Detail Views & UI Buttons"
Cohesion: 0.20
Nodes (17): UserTypeItem, AssetData, AssetDetailPage(), UserOption, Notif, Button, ButtonProps, buttonVariants (+9 more)

### Community 12 - "ITSM Domain Concepts (PRD)"
Cohesion: 0.12
Nodes (22): Approver User Type, Asset Category-Conditional Fields, Audit Trail, Auditor User Type, NexusDesk PRD v2.0, Purchase to Asset Auto-Generation, Requester User Type, Role vs User Type Separation (+14 more)

### Community 13 - "Dashboard Pages & Layout"
Cohesion: 0.16
Nodes (18): ChangePasswordPage(), OnboardingPage(), AssetsPage(), DashboardLayout(), DashboardListItem, DashboardPage(), TaskRow, TicketRow (+10 more)

### Community 14 - "Shared Type Definitions"
Cohesion: 0.10
Nodes (20): TaskData, TaskFormData, ApiResponse, AssetCategory, AssetState, ChecklistItem, CommentData, DashboardConfig (+12 more)

### Community 15 - "Navigation & Access Control"
Cohesion: 0.24
Nodes (15): SuperAdminHubPage(), FeatureSearch(), ALL_NAV, AppNavItem, DEFAULT_NAV_ACCESS, filterNavForUser(), NavAccessMap, SUPERADMIN_NAV (+7 more)

### Community 16 - "Tasks & Ticket Metadata"
Cohesion: 0.15
Nodes (15): COLUMNS, EMPTY_FORM, getAssigneeName(), getTicketLabel(), PopulatedRef, PRIORITIES, TaskCard(), UserOption (+7 more)

### Community 17 - "Notification Dispatch"
Cohesion: 0.23
Nodes (14): POST(), POST(), normalizeDepartments(), isTypeEnabled(), notifyDepartmentLabel(), notifySuperAdmins(), NotifyType, notifyUser() (+6 more)

### Community 18 - "App Shell & Sidebar"
Cohesion: 0.26
Nodes (12): AppShell(), HorizontalNav(), MAP, NavIcon(), CollapsedFlyout(), Sidebar(), usePreferences(), ToolbarButton() (+4 more)

### Community 19 - "Database & Asset Models"
Cohesion: 0.15
Nodes (10): GET(), GET(), globalWithMongoose, MongooseCache, AssetSchema, IAsset, IPurchase, PurchaseSchema (+2 more)

### Community 20 - "Session & JWT Auth"
Cohesion: 0.22
Nodes (11): POST(), POST(), DELETE(), GET(), AuthContextType, clearSession(), JWT_SECRET, setSessionCookie() (+3 more)

### Community 21 - "Import Flow & Onboarding"
Cohesion: 0.14
Nodes (11): IMAGE_EXT, ImportFailure, ImportHistoryRow, ImportKind, ImportSummary, LastImportResult, OnboardingData, Step (+3 more)

### Community 22 - "Table Columns & Roles UI"
Cohesion: 0.16
Nodes (14): ColId, ColumnDef, DEFAULT_COLUMNS, emptyForm, ImportHistoryRow, loadPageSize(), loadSavedColumns(), PAGE_SIZE_OPTIONS (+6 more)

### Community 23 - "Settings & Dashboard Schema"
Cohesion: 0.15
Nodes (12): GET(), isDeptRoleLabel(), DashboardSchema, IDashboard, ISettings, ISite, ISLA, ITicketTemplate (+4 more)

### Community 24 - "Runtime Dependencies"
Cohesion: 0.15
Nodes (13): jsonwebtoken, dependencies, jsonwebtoken, @radix-ui/react-accordion, @radix-ui/react-navigation-menu, @radix-ui/react-popover, @radix-ui/react-progress, @radix-ui/react-toast (+5 more)

### Community 25 - "Departments & Import History"
Cohesion: 0.19
Nodes (11): asList(), DeptItem, DeptRoles, emptyRoles(), genId(), GET(), POST(), FailureSchema (+3 more)

### Community 26 - "Dashboard Configuration"
Cohesion: 0.36
Nodes (8): GET(), POST(), PUT(), DashboardKey, DashboardMeta, dashboardsVisibleTo(), resolveDefaultDashboardKey(), SYSTEM_DASHBOARDS

### Community 27 - "User Management API"
Cohesion: 0.29
Nodes (9): DEFAULT_USER_TYPES, GET(), isEmail(), normalizeRole(), normalizeStatus(), parseUserTypes(), POST(), ROLES (+1 more)

### Community 28 - "Department Roles"
Cohesion: 0.22
Nodes (8): Department, Template, DepartmentRecord, DepartmentRoles, DEPT_ROLE_LABELS, DeptRoleLabel, emptyRoles(), normalizeDepartment()

### Community 29 - "Preferences & Notification Sound"
Cohesion: 0.38
Nodes (8): LAYOUTS, PreferencesPage(), SYSTEM_COLORS, getAudio(), isNotificationSoundMuted(), playNotificationSound(), setNotificationSoundMuted(), unlockNotificationSound()

### Community 30 - "Preferences Provider"
Cohesion: 0.33
Nodes (8): applySystemColor(), defaults, Preferences, PreferencesContext, PreferencesContextType, PreferencesProvider(), SystemColor, NavLayout

### Community 31 - "Audit Log Model"
Cohesion: 0.33
Nodes (5): GET(), GET(), AuditLogSchema, IAuditLog, escapeRegex()

### Community 32 - "Category Migration Script"
Cohesion: 0.33
Nodes (5): env, fs, m, path, uri

### Community 33 - "Auth Proxy Middleware"
Cohesion: 0.40
Nodes (3): config, JWT_SECRET, publicPaths

### Community 34 - "SLA & Escalation Concepts"
Cohesion: 0.50
Nodes (4): Escalation Matrix, Cross-cutting Notification System, Priority Matrix Impact x Urgency, SLA with Business Hours

### Community 35 - "Request Types Patch Script"
Cohesion: 0.50
Nodes (3): c, db, value

## Knowledge Gaps
- **322 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+317 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Runtime Dependencies` to `Spreadsheet Import/Export & Templates`, `Build & Dev Tooling`, `Community 36`, `Community 37`, `Community 38`, `Community 39`, `Community 42`, `Community 43`, `Community 45`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 50`, `Community 52`, `Community 53`, `Community 54`, `Community 55`, `Community 56`, `Community 57`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 62`, `Community 63`, `Community 64`, `Community 65`, `Community 66`, `Community 67`, `Community 68`, `Community 69`, `Community 70`, `Community 71`, `Community 72`, `Community 73`, `Community 74`, `Community 75`, `Community 76`, `Community 77`, `Community 78`, `Community 79`, `Community 80`, `Community 81`, `Community 82`?**
  _High betweenness centrality (0.235) - this node is a cross-community bridge._
- **Why does `parseSpreadsheetFile()` connect `Spreadsheet Import/Export & Templates` to `Config Constants & Asset Enums`, `Import Flow & Onboarding`, `Table Columns & Roles UI`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Why does `xlsx` connect `Spreadsheet Import/Export & Templates` to `Runtime Dependencies`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _322 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Spreadsheet Import/Export & Templates` be split into smaller, more focused modules?**
  _Cohesion score 0.05541346973572037 - nodes in this community are weakly interconnected._
- **Should `Brand & Theming System` be split into smaller, more focused modules?**
  _Cohesion score 0.061057692307692306 - nodes in this community are weakly interconnected._
- **Should `Ticket Core & Settings` be split into smaller, more focused modules?**
  _Cohesion score 0.07227891156462585 - nodes in this community are weakly interconnected._