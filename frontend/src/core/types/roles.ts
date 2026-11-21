// GET /api/roles (each item), and what POST / PATCH /api/roles return
export type RoleDetail = {
  id: string;
  name: string;
  color: string;         // lowercase #rrggbb
  index: number;         // 0 = top of the list
  isDefault: boolean;    // new accounts get this role (exactly one is)
  permissions: string[]; // names from GET /api/roles/permissions, sorted
  userCount: number;
};

// The editable part of a role on the Roles page
export type RoleDraft = {
  name: string;
  color: string;
  permissions: string[];
};
