import mongoose from "mongoose";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { Settings, SLA, Site } from "@/lib/models/Settings";
import bcryptjs from "bcryptjs";
import { DEFAULT_ONBOARDING } from "@/lib/onboarding";

import { systemStatusesForSettings } from "@/lib/ticket-status";

const DEFAULT_STATUSES = systemStatusesForSettings();

const DEFAULT_CLOSURE_CODES = [
  { id: "cc-success", name: "Success", description: "Issue resolved successfully" },
  { id: "cc-rejected", name: "Rejected", description: "Request rejected" },
  { id: "cc-unable", name: "Unable to Reproduce", description: "Issue could not be reproduced" },
  { id: "cc-duplicate", name: "Duplicate", description: "Duplicate of existing ticket" },
];

const DEFAULT_ASSET_STATES = [
  { id: "as-in-use", name: "In Use", description: "Currently assigned and in use" },
  { id: "as-warehouse", name: "In Warehouse", description: "Stored in warehouse" },
  { id: "as-repair", name: "In Repair", description: "Being repaired" },
  { id: "as-broken", name: "Broken", description: "Non-functional" },
  { id: "as-disposed", name: "Disposed", description: "Decommissioned" },
];

const DEFAULT_ASSET_TYPES = [
  { id: "at-laptop", name: "Laptop", apiname: "laptop", category: "IT", types: "Hardware", type: "Hardware", description: "Portable computer" },
  { id: "at-desktop", name: "Desktop", apiname: "desktop", category: "IT", types: "Hardware", type: "Hardware", description: "Desktop computer" },
  { id: "at-monitor", name: "Monitor", apiname: "monitor", category: "IT", types: "Hardware", type: "Hardware", description: "Display monitor" },
  { id: "at-printer", name: "Printer", apiname: "printer", category: "IT", types: "Hardware", type: "Hardware", description: "Printing device" },
  { id: "at-server", name: "Server", apiname: "server", category: "IT", types: "Hardware", type: "Hardware", description: "Server hardware" },
  { id: "at-network", name: "Network Equipment", apiname: "network-equipment", category: "IT", types: "Hardware", type: "Hardware", description: "Switches, routers, APs" },
  { id: "at-os", name: "Operating System", apiname: "os", category: "IT", types: "Software", type: "Software", description: "OS license" },
  { id: "at-productivity", name: "Productivity Suite", apiname: "productivity", category: "IT", types: "Software", type: "Software", description: "Office software" },
  { id: "at-antivirus", name: "Antivirus", apiname: "antivirus", category: "IT", types: "Software", type: "Software", description: "Security software" },
  { id: "at-toner", name: "Toner", apiname: "toner", category: "IT", types: "Consumable", type: "Consumable", description: "Printer toner" },
  { id: "at-cable", name: "Cable", apiname: "cable", category: "IT", types: "Consumable", type: "Consumable", description: "Cables and connectors" },
];

const DEFAULT_USER_TYPES = [
  { id: "ut-requester", name: "Requester", description: "Creates and monitors own tickets" },
  { id: "ut-technician", name: "Technician", description: "Works on assigned tickets" },
  { id: "ut-approver", name: "Approver", description: "Approves requests and purchases" },
  { id: "ut-auditor", name: "Auditor", description: "Read-only compliance review" },
];

const DEFAULT_IMPACTS = [
  { id: "imp-vl", name: "Very Low", description: "Very Low Impact" },
  { id: "imp-l", name: "Low", description: "Low Impact" },
  { id: "imp-n", name: "Normal", description: "Normal Impact" },
  { id: "imp-h", name: "High", description: "High Impact" },
  { id: "imp-vh", name: "Very High", description: "Very High Impact" },
];

const DEFAULT_URGENCIES = [
  { id: "urg-vl", name: "Very Low", description: "Very Low Urgent" },
  { id: "urg-l", name: "Low", description: "Low Urgent" },
  { id: "urg-n", name: "Normal", description: "Normal Urgent" },
  { id: "urg-h", name: "High", description: "High Urgent" },
  { id: "urg-vh", name: "Very High", description: "Very High Urgent" },
];

const DEFAULT_PRIORITY_MATRIX = {
  "Very Low": { "Very Low": "Very Low", Low: "Very Low", Normal: "Low", High: "Low", "Very High": "Normal" },
  Low: { "Very Low": "Very Low", Low: "Low", Normal: "Low", High: "Normal", "Very High": "High" },
  Normal: { "Very Low": "Low", Low: "Low", Normal: "Normal", High: "High", "Very High": "High" },
  High: { "Very Low": "Low", Low: "Normal", Normal: "High", High: "High", "Very High": "Very High" },
  "Very High": { "Very Low": "Normal", Low: "High", Normal: "High", High: "Very High", "Very High": "Very High" },
};

/** Wipe all application collections for a true factory reset. */
export async function wipeDatabase(): Promise<void> {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection");
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    // Keep system collections
    if (col.name.startsWith("system.")) continue;
    await db.collection(col.name).deleteMany({});
  }
}

export async function seedDatabase(options?: { force?: boolean }) {
  await connectDB();

  const force = Boolean(options?.force);
  const existingAdmin = await User.findOne({ username: "admin" });

  if (existingAdmin && !force) {
    return { seeded: false, message: "Database already seeded", forced: false };
  }

  if (force) {
    await wipeDatabase();
  }

  const hashedPassword = await bcryptjs.hash("admin", 12);

  // SuperAdmin only — must change password on first login; no departments/users yet
  await User.create({
    displayName: "System Administrator",
    username: "admin",
    password: hashedPassword,
    role: "SuperAdmin",
    userTypes: ["Requester", "Technician", "Approver"],
    jobTitle: "IT Administrator",
    department: "",
    employeeId: "EMP-001",
    email: "admin@nexusdesk.local",
    status: "Active",
    mustChangePassword: true,
  });

  const settingsData = [
    { key: "ticketStatuses", value: DEFAULT_STATUSES },
    // Fresh system: empty — SuperAdmin fills via onboarding
    { key: "departments", value: [] },
    { key: "closureCodes", value: DEFAULT_CLOSURE_CODES },
    { key: "assetStates", value: DEFAULT_ASSET_STATES },
    { key: "assetTypes", value: DEFAULT_ASSET_TYPES },
    { key: "userTypes", value: DEFAULT_USER_TYPES },
    { key: "priorityMatrix", value: DEFAULT_PRIORITY_MATRIX },
    {
      key: "requestTypes",
      value: [
        {
          id: "rt-incident",
          name: "Incident",
          description: "Unplanned interruption or reduction in quality",
          ticketCode: "INC",
        },
        {
          id: "rt-request",
          name: "Request",
          description: "Formal request for something to be provided",
          ticketCode: "REQ",
        },
      ],
    },
    { key: "impacts", value: DEFAULT_IMPACTS },
    { key: "urgencies", value: DEFAULT_URGENCIES },
    {
      key: "priorities",
      value: [
        { id: "pri-vl", name: "Very Low", description: "Very Low Priority", color: "#94A3B8", slaId: "sla-default" },
        { id: "pri-l", name: "Low", description: "Low Priority", color: "#3B82F6", slaId: "sla-default" },
        { id: "pri-n", name: "Normal", description: "Normal Priority", color: "#22C55E", slaId: "sla-default" },
        { id: "pri-h", name: "High", description: "High Priority", color: "#F97316", slaId: "sla-default" },
        { id: "pri-vh", name: "Very High", description: "Very High Priority", color: "#EF4444", slaId: "sla-default" },
      ],
    },
    // Categories empty until departments exist
    { key: "ticketCategories", value: [] },
    { key: "ticketTemplates", value: [] },
    { key: "navAccess", value: { dashboard: "all", requests: "all", assets: "all" } },
    { key: "navOrder", value: ["dashboard", "requests", "assets"] },
    {
      key: "acknowledgmentForm",
      value: {
        enabled: false,
        message:
          "<p>Dear {{displayName}},</p><p>Asset <strong>{{assetName}}</strong> ({{assetTag}}) has been assigned to you.</p>",
      },
    },
    {
      key: "appearance",
      value: {
        appName: "NexusDesk",
        logo: "/Images/default.png",
        icon: "/Images/default.png",
        font: "Inter",
        fontUrl: "",
      },
    },
    {
      key: "sites",
      value: [{ _id: "site-hq", name: "Headquarters", address: "Main Office", timezone: "Asia/Jakarta" }],
    },
    {
      key: "smtp",
      value: {
        host: "",
        port: "587",
        secure: false,
        username: "",
        password: "",
        fromEmail: "noreply@nexusdesk.local",
        fromName: "NexusDesk",
      },
    },
    { key: "autoCloseAfterDays", value: 3 },
    { key: "reopenWindowDays", value: 7 },
    { key: "maxAttachmentSize", value: 10 * 1024 * 1024 },
    {
      key: "allowedFileTypes",
      value: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
    },
    {
      key: "notificationSettings",
      value: {
        ticketCreated: { enabled: true, template: "A new ticket {{ticketNumber}} has been created." },
        ticketAssigned: { enabled: true, template: "Ticket {{ticketNumber}} has been assigned to you." },
        statusChanged: { enabled: true, template: "Ticket {{ticketNumber}} status changed to {{status}}." },
        commentAdded: { enabled: true, template: "New comment on ticket {{ticketNumber}}." },
        slaWarning: { enabled: true, template: "Ticket {{ticketNumber}} is approaching SLA breach." },
        slaBreach: { enabled: true, template: "Ticket {{ticketNumber}} has breached SLA!" },
        approvalRequested: { enabled: true, template: "Approval needed for {{type}} {{id}}." },
        approvalDecision: { enabled: true, template: "{{type}} {{id}} has been {{decision}}." },
        assetAssigned: { enabled: true, template: "Asset {{assetTag}} has been assigned to you." },
        purchaseUpdate: { enabled: true, template: "Purchase request {{id}} status: {{status}}." },
      },
    },
    // SuperAdmin must complete onboarding when system is factory-default
    { key: "onboarding", value: { ...DEFAULT_ONBOARDING } },
  ];

  await Settings.insertMany(settingsData);

  const defaultSla = {
    id: "sla-default",
    name: "Default SLA",
    description: "Standard response time",
    duration: 480,
    businessHours: { days: ["Mon", "Tue", "Wed", "Thu", "Fri"], startHour: 8, endHour: 17 },
    holidays: [] as string[],
    escalation: [
      { percentage: 75, notifyRoles: ["Technician"] },
      { percentage: 100, notifyRoles: ["Technician", "SuperAdmin"] },
    ],
  };

  await Settings.findOneAndUpdate({ key: "slaConfigs" }, { value: [defaultSla] }, { upsert: true });

  await SLA.create({
    name: defaultSla.name,
    description: defaultSla.description,
    duration: defaultSla.duration,
    businessHours: { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 17 },
    holidays: [],
    escalation: defaultSla.escalation,
  });

  await Site.create({
    name: "Headquarters",
    address: "Main Office",
    timezone: "Asia/Jakarta",
  });

  return {
    seeded: true,
    forced: force,
    message: force
      ? "Database wiped and re-seeded (fresh). Login: admin / admin — force password change + onboarding."
      : "Database seeded (fresh). Login: admin / admin — force password change + onboarding.",
  };
}
