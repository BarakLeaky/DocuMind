import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { can, roleFromClerk, type Permission, type Role } from "@/lib/rbac";
import { forbidden, unauthorized } from "@/lib/errors";

export type Tenant = {
  userId: string;
  /** Clerk org id, or the user id for a personal workspace. Used as the organization slug. */
  tenantKey: string;
  role: Role;
  /** Display name, e.g. "Amina Otieno". */
  name: string;
  /** First name for greetings; falls back to the part of the email before the @. */
  firstName: string;
  email: string;
};

export const getTenant = cache(async (): Promise<Tenant> => {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) throw unauthorized();
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const emailName = email.split("@")[0] ?? "";
  const name = user?.fullName ?? user?.firstName ?? user?.username ?? (emailName || "Account");
  return {
    userId,
    tenantKey: orgId ?? userId,
    role: orgId ? roleFromClerk(orgRole) : "owner",
    name,
    firstName: user?.firstName ?? user?.username ?? (emailName || "there"),
    email,
  };
});

export function requirePermission(tenant: Tenant, permission: Permission) {
  if (!can(tenant.role, permission)) throw forbidden(permission);
}
