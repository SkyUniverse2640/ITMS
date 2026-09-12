# Product Requirements Document — NexusDesk
### IT Service Management System

**Versi:** 2.0 (Revisi audit dari draft awal)
**Tech Stack:** Next.js (App Router) · Shadcn/ui · Bun (runtime & package manager) · PostgreSQL (Prisma) · Docker

---

## 1. Ringkasan Produk

NexusDesk adalah aplikasi ITSM (IT Service Management) berbasis web yang menangani tiga domain utama: **Request/Ticket Management**, **Asset Management**, dan **Task & Purchase Management**, dengan dashboard yang dapat dikustomisasi penuh oleh masing-masing pengguna.

Sistem dirancang single-tenant (satu instance untuk satu organisasi), dideploy via Docker, dengan PostgreSQL sebagai penyimpanan utama. Skema relasional (tabel, relasi, foreign key) didefinisikan di `prisma/schema.prisma` dengan riwayat perubahan ter-versi di `prisma/migrations/` sebagai artefak audit.

---

## 2. Aktor, Role, dan User Type

Draft awal memakai istilah **Role** dan **User Type** secara bergantian tanpa batas yang jelas. Keduanya dipisah sebagai dua axis berbeda:

### 2.1 Role — Access Level (fixed, sistem)
Menentukan apakah pengguna punya akses ke SuperAdmin Panel atau tidak.

| Role | Akses |
|---|---|
| SuperAdmin | Seluruh SuperAdmin Feature + General Feature |
| User | General Feature saja |

> V1: hanya 2 nilai fixed (tidak di-CRUD). Role granular tambahan (mis. "IT Manager" dengan akses admin parsial) masuk roadmap V2 — lihat Section 12.

### 2.2 User Type — Klasifikasi Fungsional (extensible, dikelola SuperAdmin)
Menentukan dashboard, business logic, dan eligibility (siapa yang muncul di dropdown Technician/Approver, dsb). Satu user bisa punya lebih dari satu User Type.

| User Type | Fungsi | Permission |
|---|---|---|
| Requester | Membuat & memantau ticket sendiri | CRU ticket miliknya, read My Assets |
| Technician | Mengerjakan ticket yang di-assign | CRU ticket assigned, akses Group queue |
| Approver | Menyetujui request/purchase yang butuh approval | Approve/reject item yang ditujukan ke dia |
| Auditor | Peninjauan kepatuhan, **read-only** | Read semua modul (ticket, asset, user, purchase) + Audit Trail (Section 9). Tidak bisa create/update/delete apapun. |

Item **"Mengelola Role (CRUD)"** di draft awal → direinterpretasi jadi **CRUD User Type**, karena Role bersifat fixed system-level (CRUD bebas di situ berisiko privilege escalation tanpa permission matrix yang jelas).

### 2.3 Multi User Type per User
Jika user punya lebih dari satu User Type (mis. Requester + Technician), Dynamic Navbar menampilkan gabungan menu dari semua type miliknya, dan Dashboard default menggabungkan seluruh dashboard yang relevan (My Ticket History + Ticket Assigned to Me, dst.) sebagai widget terpisah — bukan saling menimpa.

---

## 3. Model Data

### 3.1 User
| Field | Tipe | Keterangan |
|---|---|---|
| Role | Enum | SuperAdmin / User |
| DisplayName | String | |
| Username | String | Unik |
| Password | Hash (bcrypt/argon2) | |
| User Type | Array | Multi-select dari master User Type |
| Job Title | String | |
| Department | String | |
| Employee ID | String | Unik |
| Mobile | String | |
| Email | String | Unik, dipakai untuk notifikasi |
| Site | Reference | Ke master Site |
| Status | Enum | Active / Inactive |
| Last Login | DateTime | Auto |

### 3.2 Ticket / Request
| Field | Tipe | Keterangan |
|---|---|---|
| Req Type | Dropdown | Master: Incident, Request |
| Status | Dropdown | Master Status |
| Impact | Dropdown | **Ditambahkan — hilang di draft awal** |
| Urgency | Dropdown | |
| Priority | Dropdown | Auto-suggest dari Priority Matrix (Impact × Urgency), tetap bisa di-override manual oleh Technician |
| Group | Dropdown | Tim penanganan (default: Helpdesk & Support) — beda konsep dari Department milik requester |
| Category / Sub Category | Dropdown | Master data, dikelola di Ticket Template |
| Project | Dropdown | **Perlu master data baru** — lihat Section 11 |
| DisplayName, Email | Auto-filled | Dari akun login |
| Related Assets | Dropdown | Dari My Assets milik requester |
| Technician | Dropdown | Dari User dengan Type = Technician |
| Subject | String | |
| Description | Rich text | |
| Attachment | File[] | **Ditambahkan** — lihat Section 10 untuk batasan |
| Approver | Dropdown | Terisi otomatis jika dibuat dari Template ber-Approval |
| Closure Code | Dropdown | Diisi saat resolve/close |
| Resolution Notes | Rich text | |
| Resolved At / Closed At | DateTime | Auto |

### 3.3 Asset
| Field | Tipe | Keterangan |
|---|---|---|
| Name, Product/Asset Type | | Header |
| Asset Tag | String, unik | Key utama untuk import/dedup |
| Serial Number | String | Wajib untuk Hardware, opsional lainnya |
| Vendor | String | |
| Purchase Cost | Number | |
| Purchase Date | Date | **Ditambahkan** — hilang di draft awal, dibutuhkan untuk laporan depresiasi |
| Expired Date | Date | |
| Warranty Expired Date | Date | |
| Current State | Dropdown | Master Assets State |
| Assigned To | Reference User | |
| Department | Auto | Diturunkan dari data Assigned To |
| Site | Dropdown | |
| Comment | Text | |

**Field kondisional per kategori Asset Type** (baru, mengisi celah generik-form):

| Kategori | Field tambahan |
|---|---|
| Hardware | Serial Number (wajib) |
| Software | License Key, Total Seats, Seats Used |
| Consumable | Stock Quantity, Reorder Threshold, Unit (bukan Serial Number/single Assigned To) |

### 3.4 Task (baru — sebelumnya kosong total di draft)
| Field | Tipe |
|---|---|
| Title | String |
| Description | Rich text |
| Related Ticket | Reference (opsional, untuk subtask dari ticket) |
| Assignee | Reference User |
| Due Date | Date |
| Status | To Do / In Progress / Done |
| Priority | Dropdown (share master dengan Ticket Priority) |
| Checklist | Array of {item, done} |

### 3.5 Purchase Request (baru — sebelumnya kosong total di draft)
| Field | Tipe |
|---|---|
| Item Name | String |
| Linked Asset Type | Reference (untuk prefill saat asset dibuat nanti) |
| Quantity | Number |
| Estimated Cost | Number |
| Vendor | String |
| Justification | Text |
| Requested By | Auto |
| Approver | Dropdown (User Type = Approver) |
| Status | Draft / Pending Approval / Approved / Rejected / Completed |
| Linked Asset | Reference (terisi otomatis saat status Completed) |

---

## 4. Autentikasi & Keamanan

- Login: Username/Email + Password, hash bcrypt/argon2, session via JWT httpOnly cookie (atau NextAuth credentials provider).
- **Default admin (`admin`/`admin`) wajib force-change password di login pertama** — ini celah keamanan di draft awal.
- Password policy minimum: 8 karakter, kombinasi huruf & angka.
- RBAC ditegakkan di **API middleware level**, bukan cuma disembunyikan di UI (mencegah akses langsung via endpoint oleh user yang harusnya tidak berhak).
- Rate limiting di endpoint login (brute-force protection).
- Roadmap V2: SSO via Microsoft Entra ID (OIDC) — relevan karena target organisasi kemungkinan sudah di ekosistem M365; 2FA opsional.

---

## 5. Desain Frontend & UX

1. Professional, Modern, Minimalist.
2. Dynamic Navbar — SuperAdmin mengatur aksesibilitas menu per User Type, urutan menu bisa di-reorder per user.
3. User Preference: Light/Dark theme, pilihan Navigation Layout (Sidebar / Top bar / Bottom bar).
4. **Ditambahkan:** Responsive wajib untuk desktop, tablet, dan mobile web (mengingat opsi Bottom bar navigation mengindikasikan use-case mobile). PWA & multi-bahasa (ID/EN) masuk roadmap, bukan V1.

---

## 6. General Feature — Detail

### 6.1 Dynamic Customization Dashboard
User dapat membuat lebih dari satu dashboard, masing-masing dengan kombinasi Widget bebas (Graph Widget, Table Widget) dan layout drag-and-drop. Sumber data widget: Ticket, Asset, SLA Compliance, Task, Purchase — dibatasi hanya data yang memang berhak dilihat user tersebut (RBAC tetap berlaku di level data widget).

### 6.2 Requests

**Ticket Lifecycle (baru — belum didefinisikan di draft):**

```
Open → In Progress → (Pending Approval, jika dari Template ber-Approval) → Resolved → Closed
                ↕ On Hold (pause SLA)
Closed/Resolved → Reopened (dalam window waktu tertentu, default 7 hari)
```

- Auto-close: Ticket berstatus **Resolved** otomatis pindah ke **Closed** jika tidak ada aktivitas/reopen dari Requester dalam N hari (default 3 hari, configurable).
- Reopen window: Requester bisa reopen ticket Resolved/Closed dalam N hari (default 7 hari); lewat itu harus buat ticket baru dengan referensi ke ticket lama.

**Priority Matrix (baru — mengisi celah Impact yang hilang dari form):**

| Impact \ Urgency | Very Low | Low | Normal | High | Very High |
|---|---|---|---|---|---|
| Very Low | Very Low | Very Low | Low | Low | Normal |
| Low | Very Low | Low | Low | Normal | High |
| Normal | Low | Low | Normal | High | High |
| High | Low | Normal | High | High | Very High |
| Very High | Normal | High | High | Very High | Very High |

Matrix ini adalah default dan dapat diedit SuperAdmin di Ticket Settings. Priority hasil matrix bersifat **saran otomatis**, tetap bisa di-override manual.

**Dashboard sesuai User Type:**
- Requester → "My Ticket History"
- Technician → "Ticket Assigned to Me", "Open Ticket", "Closed Ticket" (semua dynamic, bisa ditambah widget custom)

**SLA & Breach (diperjelas):**
- SLA berjalan hanya selama jam operasional yang didefinisikan SuperAdmin (mis. Senin–Jumat 08:00–17:00), dikurangi tanggal di Kalender Libur.
- SLA berhenti (pause) hanya jika Status ticket memiliki toggle "timer stop" aktif.
- Jika Technician tidak merespon melewati durasi SLA → status breach = **Breach**.
- **Escalation Matrix (baru):** notifikasi bertingkat — 75% waktu SLA terpakai → notify Technician; 100% (breach) → notify Technician + Group Lead; breach +N jam → notify SuperAdmin/Manager. Threshold dapat dikonfigurasi per Priority di SLA Settings.

**Komentar (baru):**
- Public Reply (terlihat oleh Requester) vs Private Note (internal, hanya Technician/Approver/Auditor).
- Attachment didukung di Description ticket maupun di setiap komentar.

### 6.3 Assets
"My Assets" — assets yang di-assign ke user, dipisah per kategori: Hardware / Software / Consumable, masing-masing menampilkan field yang relevan (mis. Consumable menampilkan sisa stock, bukan serial number).

### 6.4 Tasks (baru)
Dashboard "My Tasks" menampilkan task yang di-assign ke user, dikelompokkan per Status (To Do / In Progress / Done). Task bisa berdiri sendiri atau menjadi subtask dari sebuah Ticket.

### 6.5 Reports (baru)
Laporan predefined minimal V1:
- Ticket Volume (per Category, Technician, Priority)
- SLA Compliance %
- Average Resolution Time
- Asset Inventory (per Type, State, Department)
- Technician Performance
- Purchase Spend

Export ke PDF/Excel/CSV. Scheduled report (harian/mingguan/bulanan) dikirim via email menggunakan Notification Settings (Section 8). Custom report builder (pilih field/filter bebas) masuk roadmap V2.

### 6.6 Purchases (baru)
Alur: Requester membuat Purchase Request → notifikasi ke Approver → Approve/Reject → jika Approved, status jadi "Completed" saat procurement selesai → **otomatis generate record Asset baru**, dengan Purchase Cost, Vendor, dan Purchase Date terisi dari data Purchase Request (menutup loop dengan modul Assets).

---

## 7. SuperAdmin Feature — Detail

### 7.1 Requests Management

**Ticket Settings** — semua entity berikut punya tombol "New [Entity]" → card overlay form:

| Entity | Field Card Overlay | Default Value |
|---|---|---|
| Group | Name, Description | Helpdesk & Support |
| Status | Name, Description, Toggle Timer Stop, Color | **Ditambahkan:** Open, In Progress, Pending Approval, On Hold, Resolved, Closed, Reopened (Timer Stop aktif untuk Pending Approval, On Hold, Resolved, Closed) |
| Impact | Name, Description | Very Low, Low, Normal, High, Very High |
| Urgency | Name, Description | Very Low, Low, Normal, High, Very High |
| Priority | Name, Description, Color, SLA (dropdown) | Very Low, Low, Normal, High, Very High |
| Request Type | Name, Description | Incident, Request |
| Closure Code | Name, Description | Rejected, Success, Unable to Reproduce |
| **Priority Matrix** (baru) | Grid editor Impact × Urgency → Priority | Lihat tabel default Section 6.2 |

**Ticket Template:**
- "New Category" → card overlay (name, description) → setelah disimpan, buka tab **Templates**.
- **"New Sub Category" (ditambahkan)** — nested di dalam Category yang sudah dibuat, mengikuti pola yang sama seperti Templates.
- "New Request Template" → form sama seperti Request Creation Form, plus bisa tambah/hapus section & column, plus checkbox **"Need Approval?"** — jika dicentang, kolom Approver menjadi editable (dropdown dari User Type = Approver).
- **Alur approval (diperjelas):** ticket dari template ber-Approval otomatis berstatus **Pending Approval** → Approver menerima notifikasi → Approve (status lanjut ke Open) / Reject (status Rejected, ticket ditutup dengan alasan). V1 mendukung single-level approval; multi-level approval chain masuk roadmap V2.

### 7.2 System Management

- **Notification Settings** (perluasan dari "SMTP Settings"): konfigurasi SMTP domain, plus daftar event notifikasi (lihat Section 8) yang masing-masing bisa di-toggle on/off dan template-nya diedit via rich text — pola yang sama seperti Acknowledgment Form di draft awal, digeneralisasi ke seluruh event.
- **Appearance Settings**: logo aplikasi, nama aplikasi, font (Apply General). Berlaku untuk semua user.
- **Site Settings** (CRUD): Name, Address, Timezone. Dipakai untuk lokasi asset dan opsional jam operasional per site.
- **SLA Settings**: New SLA (name, description, duration) + **Jam Operasional & Kalender Libur (baru)** — mendefinisikan hari/jam kerja dan tanggal libur yang dikecualikan dari perhitungan SLA. Ditambahkan Escalation Matrix per Priority (Section 6.2).

### 7.3 User Management
a. Mengelola User (CRUD).
b. Mengelola **User Type** (CRUD) — direvisi dari "Mengelola Role" (lihat Section 2.1).

### 7.4 Assets Management

**Assets Settings:**
- Assets Type: New Assets Type → card overlay (Assets Type, apiname, description, Category [IT/Non-IT], Icon, Parent Product Type, Types: Hardware/Software/Consumable). **Field kondisional tambahan sesuai Types dipicu di sini** (lihat Section 3.3).
- Assets State: New Assets State → card overlay (name, description). Default: Broken, In Repair, In Warehouse, In Use, Disposed.

**Manage All Assets:**
- "New Assets" — form sesuai Section 3.3.
- "Import Assets From CSV/XLSX" — **spesifikasi validasi diperjelas** (menghindari kelas masalah department-parsing yang pernah ditemukan):
  - Kolom wajib: Name, Asset Type, Asset Tag (key unik untuk deteksi baris baru vs update).
  - Matching: jika Asset Tag/Serial Number sudah ada → update record; jika belum ada → buat baru.
  - **Department tidak diimpor sebagai teks bebas** — diturunkan otomatis dari data user hasil lookup kolom "Assigned To" (via Email atau Employee ID), bukan diparsing dari nama department mentah di CSV. Ini menghindari mismatch nama department antar sheet.
  - Template CSV dengan header baku disediakan untuk didownload sebelum import.
  - Hasil import menampilkan laporan per baris (berhasil/gagal + alasan gagal), bukan cuma status sukses/gagal keseluruhan.

**Acknowledgment Form:** Toggle on/off; jika on, auto-send email saat asset di-assign ke user, dengan isi pesan (rich text) yang bisa diedit SuperAdmin — sesuai draft awal, sekarang menjadi salah satu entri di Notification Settings (Section 8).

---

## 8. Sistem Notifikasi (Cross-cutting)

| Event | Trigger | Penerima | Default | Template Editable |
|---|---|---|---|---|
| Ticket Created | Ticket baru dibuat | Requester, Technician di Group terkait | On | Ya |
| Ticket Assigned | Technician di-assign | Technician | On | Ya |
| Status Changed | Status berubah | Requester | On | Ya |
| Comment Added (Public) | Reply publik ditambahkan | Pihak lawan bicara | On | Ya |
| SLA Warning/Breach | Sesuai Escalation Matrix | Technician, Group Lead, SuperAdmin | On | Ya |
| Approval Requested | Ticket/Purchase butuh approval | Approver | On | Ya |
| Approval Decision | Approve/Reject diputuskan | Requester | On | Ya |
| Asset Assigned | Asset di-assign ke user | User terkait | Toggle (default sesuai draft awal) | Ya |
| Purchase Status Update | Status Purchase Request berubah | Requester, Approver | On | Ya |

In-app notification (bell icon) di V1; real-time push via SSE (native didukung Bun) masuk roadmap V1.1.

---

## 9. Audit Trail & Kepatuhan (baru — mengisi celah User Type "Auditor")

Setiap aksi Create/Update/Delete di modul Ticket, Asset, User, System Settings, dan Purchase dicatat dengan: Actor, Action, Timestamp, Before/After value (diff), IP Address.

User Type **Auditor** memiliki akses read-only ke seluruh Audit Trail ini plus seluruh data modul lain, untuk keperluan peninjauan kepatuhan — tanpa hak edit apapun.

---

## 10. Non-Functional Requirements

- Deployment: Docker Compose (App service + PostgreSQL; opsional MinIO/S3-compatible untuk file storage attachment — **keputusan storage strategy perlu dikonfirmasi**, lihat Section 11).
- Backup: scheduled `pg_dump` otomatis (format custom, restore via `pg_restore`).
- Migrasi skema: `prisma migrate deploy` dijalankan saat container app start; setiap perubahan tabel punya file SQL ter-versi.
- Browser support: 2 versi terakhir Chrome, Edge, Firefox, Safari.
- Attachment: batas ukuran file default 10MB/file, tipe diizinkan (image, pdf, docx, xlsx) — configurable.
- Konfigurasi environment via `.env` (bukan hardcoded).
- Logging terstruktur untuk kebutuhan Audit Trail dan debugging.

---

## 11. Asumsi & Keputusan yang Perlu Dikonfirmasi

1. **Role extensibility** — V1 diasumsikan tetap fixed 2 (SuperAdmin/User). Konfirmasi kalau butuh role granular dari awal.
2. **Approval** — diasumsikan single-level di V1. Multi-level approval chain?
3. **File storage** — Docker volume lokal, atau object storage (MinIO/S3-compatible)?
4. **Jam operasional SLA** — satu jam operasional global, atau berbeda per Site?
5. **Target scale** — perkiraan jumlah user & concurrent user untuk sizing infrastruktur.
6. **Field "Project"** — perlu didefinisikan master data-nya (siapa yang kelola, apakah terkait ke entity lain) atau dihapus dari form kalau belum dipakai.
7. **SSO Entra ID** — masuk V1 atau tetap roadmap V2?

---

## 12. Out of Scope (V1) / Roadmap

- Knowledge Base / Self-service portal untuk Requester
- Canned response / macro untuk Technician
- Business rule / workflow automation engine tingkat lanjut
- Custom report builder (V1 pakai predefined reports)
- Native mobile app (V1 cukup responsive web)
- Multi-bahasa UI (ID/EN)
- SSO Entra ID, 2FA
- Barcode/QR scanning untuk Assets
- Role granular selain SuperAdmin/User

---

*Dokumen ini adalah revisi dari draft awal, disusun ulang untuk menutup celah pada: definisi Role/User Type, field Impact yang hilang dari form ticket, modul Tasks & Purchases yang sebelumnya kosong, SLA/escalation logic, sistem notifikasi, keamanan default credential, dan spesifikasi field Asset per kategori.*
