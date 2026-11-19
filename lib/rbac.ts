export const ROLES = ["owner", "admin", "knowledge_manager", "contributor", "reader", "auditor"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "document.upload", "document.read", "document.download", "document.delete", "document.share",
  "collection.manage", "assistant.query", "extraction.run", "connector.manage",
  "audit.read", "members.manage", "billing.manage", "doc.edit",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Workspace owner",
  admin: "Administrator",
  knowledge_manager: "Knowledge manager",
  contributor: "Contributor",
  reader: "Reader",
  auditor: "Auditor",
};

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS.filter((p) => p !== "billing.manage"),
  knowledge_manager: [
    "document.upload", "document.read", "document.download", "document.delete", "document.share",
    "collection.manage", "assistant.query", "extraction.run", "doc.edit",
  ],
  contributor: ["document.upload", "document.read", "document.download", "assistant.query", "extraction.run", "doc.edit"],
  reader: ["document.read", "document.download", "assistant.query"],
  auditor: ["audit.read"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Maps a Clerk organization role string to a DocuMind role. Unknown roles get the least privilege. */
export function roleFromClerk(orgRole: string | null | undefined): Role {
  switch (orgRole) {
    case "org:owner": return "owner";
    case "org:admin": return "admin";
    case "org:knowledge_manager": return "knowledge_manager";
    case "org:contributor": return "contributor";
    case "org:auditor": return "auditor";
    case "org:member": return "contributor";
    default: return "reader";
  }
}
