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

/**
 * Detect the field delimiter from the header line.
 * A file is semicolon-delimited whenever the header has more `;` than `,`
 * (common in locales where `,` is the decimal separator). Splitting on BOTH
 * would shred fields that legitimately contain commas \u2014 e.g. a department
 * named "IT Infrastructure, Network, & Security".
 */
function detectDelimiter(headerLine: string): string {
  let semi = 0;
  let comma = 0;
  let inQuotes = false;
  for (const ch of headerLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ";") semi++;
    else if (!inQuotes && ch === ",") comma++;
  }
  return semi > comma ? ";" : ",";
}

/**
 * Full-text CSV parser (RFC-4180-ish). Handles:
 *  - quoted fields containing the delimiter, and
 *  - quoted fields containing embedded newlines (a cell that wraps across
 *    physical lines, e.g. a job title split over two lines).
 * Returns an array of rows, each an array of raw cell strings.
 */
function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  let field = false; // any content seen for the current record

  const pushField = () => {
    row.push(
      cur
        .trim()
        .replace(/^"|"$/g, "")
        .replace(/""/g, '"')
        .replace(/[\r\n]+/g, " ") // collapse newlines inside quoted cells
        .trim()
    );
    cur = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
    field = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        cur += ch; // keep quote; stripped in pushField
      }
      field = true;
    } else if (ch === delimiter && !inQuotes) {
      pushField();
      field = true;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      // Normalize CRLF: skip the \n after a \r
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (field || cur.length > 0 || row.length > 0) pushRow();
    } else {
      cur += ch;
      field = true;
    }
  }
  // Trailing record without newline
  if (field || cur.length > 0 || row.length > 0) pushRow();
  return rows;
}

export function parseCsv(text: string): RowObject[] {
  const clean = text.replace(/^\uFEFF/, "");
  // Header delimiter is detected from the first physical line only.
  const firstLine = clean.split(/\r?\n/, 1)[0] || "";
  const delimiter = detectDelimiter(firstLine);
  const raw = parseCsvRows(clean, delimiter).filter(
    (cells) => !cells.every((c) => !c)
  );
  if (raw.length < 2) return [];
  const headers = raw[0].map(normalizeHeader);
  const rows: RowObject[] = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i];
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
