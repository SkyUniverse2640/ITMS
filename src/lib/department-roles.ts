/** Department hierarchy labels used for SLA notify + ticket approval */

export const DEPT_ROLE_LABELS = ["Director", "Manager", "Supervisor"] as const;
export type DeptRoleLabel = (typeof DEPT_ROLE_LABELS)[number];

export interface DepartmentRoles {
  Director: string[];
  Manager: string[];
  Supervisor: string[];
}

export interface DepartmentRecord {
  id: string;
  name: string;
  description?: string;
  roles?: DepartmentRoles;
}

export function emptyRoles(): DepartmentRoles {
  return { Director: [], Manager: [], Supervisor: [] };
}

export function normalizeDepartment(raw: unknown, index = 0): DepartmentRecord {
  if (typeof raw === "string") {
    return { id: `dept-${index}`, name: raw.trim(), description: "", roles: emptyRoles() };
  }
  if (!raw || typeof raw !== "object") {
    return { id: `dept-${index}`, name: "", description: "", roles: emptyRoles() };
  }
  const o = raw as Record<string, unknown>;
  const rolesRaw = (o.roles || {}) as Record<string, unknown>;
  const pick = (k: DeptRoleLabel): string[] => {
    const v = rolesRaw[k];
    if (!Array.isArray(v)) return [];
    return v.map((x) => String(x)).filter(Boolean);
  };
  return {
    id: String(o.id || `dept-${index}`),
    name: String(o.name || "").trim(),
    description: o.description ? String(o.description) : "",
    roles: {
      Director: pick("Director"),
      Manager: pick("Manager"),
      Supervisor: pick("Supervisor"),
    },
  };
}

export function normalizeDepartments(raw: unknown): DepartmentRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x, i) => normalizeDepartment(x, i)).filter((d) => d.name);
}

export function isDeptRoleLabel(v: string): v is DeptRoleLabel {
  return (DEPT_ROLE_LABELS as readonly string[]).includes(v);
}

/** User IDs assigned to a label within a named department */
export function getRoleUserIds(
  departments: DepartmentRecord[],
  departmentName: string,
  label: DeptRoleLabel
): string[] {
  const dept = departments.find(
    (d) => d.name.toLowerCase() === departmentName.trim().toLowerCase()
  );
  if (!dept?.roles) return [];
  return [...(dept.roles[label] || [])];
}
