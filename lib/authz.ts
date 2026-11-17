import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import type { UserRole } from "@/lib/db/schema";

/**
 * Access rules (replace Postgres RLS; enforced on every read and write):
 *   admin   → every advisor, the Admin screen, user management
 *   va      → the advisors assigned to them in advisor_assignments
 *   advisor → only their own advisor record (advisors.user_id)
 */

export type CurrentUser = { id: string; name: string; email: string; role: UserRole };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  // Read the role from the database, not the session cache, so role changes apply immediately.
  const [row] = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
    })
    .from(schema.user)
    .where(eq(schema.user.id, session.user.id));
  return row ?? null;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") forbidden();
  return user;
}

/** Advisor IDs this user may see. `"all"` for admins. */
export const accessibleAdvisorIds = cache(
  async (user: CurrentUser): Promise<string[] | "all"> => {
    if (user.role === "admin") return "all";
    if (user.role === "va") {
      const rows = await db
        .select({ id: schema.advisorAssignments.advisorId })
        .from(schema.advisorAssignments)
        .where(eq(schema.advisorAssignments.userId, user.id));
      return rows.map((r) => r.id);
    }
    const rows = await db
      .select({ id: schema.advisors.id })
      .from(schema.advisors)
      .where(eq(schema.advisors.userId, user.id));
    return rows.map((r) => r.id);
  },
);

export async function canAccessAdvisor(user: CurrentUser, advisorId: string): Promise<boolean> {
  const ids = await accessibleAdvisorIds(user);
  return ids === "all" || ids.includes(advisorId);
}

/** Use at the top of every page and server action that touches one advisor's data. */
export async function requireAdvisorAccess(advisorId: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!(await canAccessAdvisor(user, advisorId))) forbidden();
  return user;
}
