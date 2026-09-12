/**
 * Write import CSV templates into public/Templates from the same
 * column definitions used by the app (inline mirror for ops scripts).
 */
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public", "Templates");
mkdirSync(dir, { recursive: true });

function cell(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function row(cells) {
  return cells.map(cell).join(",");
}

const user = [
  row([
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
  ]),
  row([
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
  row([
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

const department = [
  row(["name", "description"]),
  row(["IT", "Information Technology"]),
  row(["HR", "Human Resources"]),
  row(["Finance", "Finance & Accounting"]),
  row(["Operations", "Operations"]),
  "",
].join("\n");

const asset = [
  row([
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
  ]),
  row([
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
  row([
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
  row([
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

const files = {
  "user-import-template.csv": user,
  "department-import-template.csv": department,
  "asset-import-template.csv": asset,
};

for (const [name, content] of Object.entries(files)) {
  const path = join(dir, name);
  writeFileSync(path, "\uFEFF" + content, "utf8");
  console.log("wrote", path);
}
