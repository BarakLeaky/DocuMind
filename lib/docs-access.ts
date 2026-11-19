export type ShareRole = "viewer" | "editor";
export type DocRole = "owner" | ShareRole;

/** The single place that decides what a person may do with an editable document. Pure, so it is unit tested. */
export function resolveDocRole(userId: string, ownerId: string, shares: { userId: string; role: ShareRole }[]): DocRole | null {
  if (userId === ownerId) return "owner";
  return shares.find((s) => s.userId === userId)?.role ?? null;
}

export const canEditDoc = (role: DocRole | null) => role === "owner" || role === "editor";
export const canShareDoc = (role: DocRole | null) => role === "owner";
export const canDeleteDoc = (role: DocRole | null) => role === "owner";
