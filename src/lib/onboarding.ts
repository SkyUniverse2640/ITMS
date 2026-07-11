/** Shared onboarding helpers + recommendation catalogs (server & client-safe data). */

export interface OnboardingState {
  completed: boolean;
  completedAt?: string | null;
  appearanceReady: boolean;
  departmentsReady: boolean;
  usersReady: boolean;
}

export const DEFAULT_ONBOARDING: OnboardingState = {
  completed: false,
  completedAt: null,
  appearanceReady: false,
  departmentsReady: false,
  usersReady: false,
};

/** Curated org chart starter set for Generate Recommendation (departments) */
export const RECOMMENDED_DEPARTMENTS: { name: string; description: string }[] = [
  { name: "IT", description: "Information Technology" },
  { name: "HR", description: "Human Resources" },
  { name: "Finance", description: "Finance & Accounting" },
  { name: "Operations", description: "Operations" },
  { name: "Sales", description: "Sales" },
  { name: "Marketing", description: "Marketing" },
  { name: "Customer Support", description: "Customer Support / Service Desk" },
  { name: "Legal", description: "Legal & Compliance" },
];

/** Sample users for Generate Recommendation — password is temporary; mustChangePassword forced */
export const RECOMMENDED_USERS: {
  displayName: string;
  username: string;
  email: string;
  employeeId: string;
  password: string;
  role: "User";
  userTypes: string[];
  jobTitle: string;
  department: string;
  status: "Active";
}[] = [
  {
    displayName: "Alex Technician",
    username: "tech.alex",
    email: "tech.alex@example.local",
    employeeId: "EMP-TECH-001",
    password: "Welcome123",
    role: "User",
    userTypes: ["Requester", "Technician"],
    jobTitle: "IT Technician",
    department: "IT",
    status: "Active",
  },
  {
    displayName: "Sam Requester",
    username: "sam.req",
    email: "sam.req@example.local",
    employeeId: "EMP-REQ-001",
    password: "Welcome123",
    role: "User",
    userTypes: ["Requester"],
    jobTitle: "Staff",
    department: "HR",
    status: "Active",
  },
  {
    displayName: "Priya Approver",
    username: "priya.appr",
    email: "priya.appr@example.local",
    employeeId: "EMP-APP-001",
    password: "Welcome123",
    role: "User",
    userTypes: ["Requester", "Approver"],
    jobTitle: "Team Lead",
    department: "Finance",
    status: "Active",
  },
  {
    displayName: "Jordan Auditor",
    username: "jordan.aud",
    email: "jordan.aud@example.local",
    employeeId: "EMP-AUD-001",
    password: "Welcome123",
    role: "User",
    userTypes: ["Auditor"],
    jobTitle: "Compliance Auditor",
    department: "Legal",
    status: "Active",
  },
];
