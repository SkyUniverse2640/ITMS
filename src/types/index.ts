export type Role = "SuperAdmin" | "User";

export type UserType = "Requester" | "Technician" | "Approver" | "Auditor";

export type TicketStatus =
  | "Pending Approval"
  | "Open"
  | "On Hold"
  | "In Progress"
  | "Closed"
  | "Reject";

export type TicketPriority = "Very Low" | "Low" | "Normal" | "High" | "Very High";

export type TicketImpact = "Very Low" | "Low" | "Normal" | "High" | "Very High";

export type TicketUrgency = "Very Low" | "Low" | "Normal" | "High" | "Very High";

export type RequestType = "Incident" | "Request";

export type AssetCategory = "Hardware" | "Software" | "Consumable";

export type AssetState = "In Use" | "In Warehouse" | "In Repair" | "Broken" | "Disposed";

export type TaskStatus = "To Do" | "In Progress" | "Done";

export type PurchaseStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Rejected"
  | "Completed";

export interface SessionUser {
  _id: string;
  username: string;
  displayName: string;
  email: string;
  role: Role;
  userTypes: UserType[];
  department?: string;
  site?: string;
  mustChangePassword?: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  children?: NavItem[];
  requiredRole?: Role;
  requiredUserType?: UserType[];
}

export interface PriorityMatrixEntry {
  impact: TicketImpact;
  urgency: TicketUrgency;
  priority: TicketPriority;
}

export interface WidgetConfig {
  id: string;
  type: "graph" | "table" | "stat";
  title: string;
  dataSource: "tickets" | "assets" | "tasks" | "purchases" | "sla";
  chartType?: "bar" | "line" | "pie" | "doughnut" | "area";
  filters?: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface DashboardConfig {
  id: string;
  name: string;
  widgets: WidgetConfig[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CommentData {
  content: string;
  isPrivate: boolean;
  attachments?: string[];
  author: string;
  createdAt: Date;
}

export interface ChecklistItem {
  item: string;
  done: boolean;
}

export interface EscalationThreshold {
  percentage: number;
  notifyRoles: string[];
}

export interface SLAConfig {
  name: string;
  description?: string;
  duration: number;
  businessHours: {
    days: number[];
    startHour: number;
    endHour: number;
  };
  holidays: string[];
  escalation: EscalationThreshold[];
}
