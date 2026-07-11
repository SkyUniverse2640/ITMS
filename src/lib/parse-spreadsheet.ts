/**
 * Client-safe CSV + XLSX row parsing for user/asset imports.
 * Columns are normalized: trim, lower, spaces→underscore.
 */

export type RowObject = Record<string, string>;

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\w]/g, "");
}

/** Alias map → canonical User import field names matching DB schema */
export const USER_COLUMN_ALIASES: Record<string, string> = {
  displayname: "displayName",
  display_name: "displayName",
  name: "displayName",
  fullname: "displayName",
  full_name: "displayName",
  username: "username",
  user_name: "username",
  login: "username",
  email: "email",
  mail: "email",
  password: "password",
  role: "role",
  usertypes: "userTypes",
  user_types: "userTypes",
  usertype: "userTypes",
  types: "userTypes",
  jobtitle: "jobTitle",
  job_title: "jobTitle",
  title: "jobTitle",
  department: "department",
  dept: "department",
  employeeid: "employeeId",
  employee_id: "employeeId",
  emp_id: "employeeId",
  nik: "employeeId",
  mobile: "mobile",
  phone: "mobile",
  tel: "mobile",
  status: "status",
};

export function canonicalizeUserRow(raw: RowObject): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const nk = normalizeHeader(k);
    const canon = USER_COLUMN_ALIASES[nk] || nk;
    if (v != null && String(v).trim() !== "") {
      out[canon] = String(v).trim();
    }
  }
  return out;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === "," || ch === ";") && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim().replace(/^"|"$/g, ""));
}

export function parseCsv(text: string): RowObject[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rows: RowObject[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.every((c) => !c)) continue;
    const row: RowObject = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

export async function parseSpreadsheetFile(file: File): Promise<RowObject[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = await file.text();
    return parseCsv(text);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    return json.map((row) => {
      const out: RowObject = {};
      for (const [k, v] of Object.entries(row)) {
        out[normalizeHeader(String(k))] = v == null ? "" : String(v).trim();
      }
      return out;
    });
  }
  throw new Error("Unsupported file type. Use .csv, .xlsx, or .xls");
}

/** Escape a CSV cell (RFC-style quotes) */
function csvCell(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: Array<string | number>): string {
  return cells.map(csvCell).join(",");
}

/**
 * User import headers — match User model /api/users/import fields:
 * displayName, username, email, employeeId (required), password, role,
 * userTypes, jobTitle, department, mobile, status
 */
export const USER_IMPORT_HEADERS = [
  "displayName",
  "username",
  "email",
  "employeeId",
  "password",
  "role",
  "userTypes",
  "jobTitle",
  "department",
  "mobile",
  "status",
] as const;

export function userImportTemplateCsv(): string {
  return [
    csvRow([...USER_IMPORT_HEADERS]),
    csvRow([
      "Jane Doe",
      "jdoe",
      "jane@example.com",
      "EMP-100",
      "Welcome123",
      "User",
      "Requester|Technician",
      "IT Support",
      "IT",
      "+62123456789",
      "Active",
    ]),
    csvRow([
      "Sam Requester",
      "sam.req",
      "sam.req@example.com",
      "EMP-101",
      "Welcome123",
      "User",
      "Requester",
      "Staff",
      "HR",
      "",
      "Active",
    ]),
    "",
  ].join("\n");
}

/** Department import — matches settings `departments` items: name, description */
export const DEPT_COLUMN_ALIASES: Record<string, string> = {
  name: "name",
  department: "name",
  department_name: "name",
  dept: "name",
  dept_name: "name",
  description: "description",
  desc: "description",
  id: "id",
};

export function canonicalizeDeptRow(raw: RowObject): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const nk = normalizeHeader(k);
    const canon = DEPT_COLUMN_ALIASES[nk] || nk;
    if (v != null && String(v).trim() !== "") {
      out[canon] = String(v).trim();
    }
  }
  return out;
}

export const DEPT_IMPORT_HEADERS = ["name", "description"] as const;

export function departmentImportTemplateCsv(): string {
  return [
    csvRow([...DEPT_IMPORT_HEADERS]),
    csvRow(["IT", "Information Technology"]),
    csvRow(["HR", "Human Resources"]),
    csvRow(["Finance", "Finance & Accounting"]),
    csvRow(["Operations", "Operations"]),
    "",
  ].join("\n");
}

/**
 * Asset import headers — match Asset model /api/assets/import:
 * required: name, assetType, assetTag
 * optional: assetCategory, serialNumber, vendor, purchaseCost, purchaseDate,
 * warrantyExpiredDate, currentState, assignedToEmail, assignedToEmployeeId,
 * site, licenseKey, totalSeats, seatsUsed, stockQuantity, reorderThreshold, unit, comment
 */
export const ASSET_IMPORT_HEADERS = [
  "name",
  "assetType",
  "assetCategory",
  "assetTag",
  "serialNumber",
  "vendor",
  "purchaseCost",
  "purchaseDate",
  "warrantyExpiredDate",
  "currentState",
  "assignedToEmail",
  "assignedToEmployeeId",
  "site",
  "licenseKey",
  "totalSeats",
  "seatsUsed",
  "stockQuantity",
  "reorderThreshold",
  "unit",
  "comment",
] as const;

/** Alias map → canonical Asset import field names matching DB schema */
export const ASSET_COLUMN_ALIASES: Record<string, string> = {
  name: "name",
  assetname: "name",
  asset_name: "name",
  assettype: "assetType",
  asset_type: "assetType",
  type: "assetType",
  assetcategory: "assetCategory",
  asset_category: "assetCategory",
  category: "assetCategory",
  types: "assetCategory",
  assettag: "assetTag",
  asset_tag: "assetTag",
  tag: "assetTag",
  serialnumber: "serialNumber",
  serial_number: "serialNumber",
  serial: "serialNumber",
  sn: "serialNumber",
  vendor: "vendor",
  supplier: "vendor",
  purchasecost: "purchaseCost",
  purchase_cost: "purchaseCost",
  cost: "purchaseCost",
  purchasedate: "purchaseDate",
  purchase_date: "purchaseDate",
  warrantyexpireddate: "warrantyExpiredDate",
  warranty_expired_date: "warrantyExpiredDate",
  warranty: "warrantyExpiredDate",
  expireddate: "warrantyExpiredDate",
  expired_date: "warrantyExpiredDate",
  currentstate: "currentState",
  current_state: "currentState",
  state: "currentState",
  status: "currentState",
  assignedtoemail: "assignedToEmail",
  assigned_to_email: "assignedToEmail",
  email: "assignedToEmail",
  assignedtoemployeeid: "assignedToEmployeeId",
  assigned_to_employee_id: "assignedToEmployeeId",
  employeeid: "assignedToEmployeeId",
  site: "site",
  licensekey: "licenseKey",
  license_key: "licenseKey",
  totalseats: "totalSeats",
  total_seats: "totalSeats",
  seatsused: "seatsUsed",
  seats_used: "seatsUsed",
  stockquantity: "stockQuantity",
  stock_quantity: "stockQuantity",
  stock: "stockQuantity",
  reorderthreshold: "reorderThreshold",
  reorder_threshold: "reorderThreshold",
  unit: "unit",
  comment: "comment",
  notes: "comment",
};

export function canonicalizeAssetRow(raw: RowObject): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const nk = normalizeHeader(k);
    const canon = ASSET_COLUMN_ALIASES[nk] || nk;
    if (v != null && String(v).trim() !== "") {
      out[canon] = String(v).trim();
    }
  }
  return out;
}

export function assetImportTemplateCsv(): string {
  return [
    csvRow([...ASSET_IMPORT_HEADERS]),
    // Hardware sample
    csvRow([
      "Dell Latitude 5540",
      "Laptop",
      "Hardware",
      "AST-LT001",
      "SN123456",
      "Dell",
      "15000000",
      "2024-01-15",
      "2027-01-15",
      "In Use",
      "jane@example.com",
      "",
      "Headquarters",
      "",
      "",
      "",
      "",
      "",
      "",
      "Primary work laptop",
    ]),
    // Software sample
    csvRow([
      "Microsoft Office 365",
      "Productivity Suite",
      "Software",
      "AST-SW001",
      "",
      "Microsoft",
      "5000000",
      "2024-02-01",
      "",
      "In Use",
      "",
      "",
      "Headquarters",
      "XXXXX-XXXXX-XXXXX",
      "50",
      "12",
      "",
      "",
      "",
      "Enterprise license pool",
    ]),
    // Consumable sample
    csvRow([
      "HP Toner 26A",
      "Toner",
      "Consumable",
      "AST-CN001",
      "",
      "HP",
      "800000",
      "2024-03-01",
      "",
      "In Warehouse",
      "",
      "",
      "Headquarters",
      "",
      "",
      "",
      "25",
      "5",
      "pcs",
      "Warehouse stock",
    ]),
    "",
  ].join("\n");
}

export type TemplateKind = "user" | "department" | "asset";

export function getImportTemplateCsv(kind: TemplateKind): string {
  switch (kind) {
    case "user":
      return userImportTemplateCsv();
    case "department":
      return departmentImportTemplateCsv();
    case "asset":
      return assetImportTemplateCsv();
    default:
      return "";
  }
}

export function getImportTemplateFilename(kind: TemplateKind): string {
  switch (kind) {
    case "user":
      return "user-import-template.csv";
    case "department":
      return "department-import-template.csv";
    case "asset":
      return "asset-import-template.csv";
    default:
      return "import-template.csv";
  }
}
