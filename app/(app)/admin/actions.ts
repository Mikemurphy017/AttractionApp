"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { db, schema } from "@/lib/db";
import { createPasswordUser, findUserByEmail, setUserPassword } from "@/lib/users";

export type ActionState = { error?: string; message?: string } | null;

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`).max(128);

async function audit(actorUserId: string, action: string, entity: string, entityId: string | null, data?: unknown) {
  await db.insert(schema.auditLog).values({ actorUserId, action, entity, entityId, data: data ?? null });
}

// ─── Users ──────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  role: z.enum(["admin", "va", "advisor"]),
  password,
});

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const v = parsed.data;

  if (await findUserByEmail(db, v.email)) return { error: "A user with that email already exists." };
  const created = await createPasswordUser(db, v);
  await audit(admin.id, "user.created", "user", created.id, { email: v.email, role: v.role });

  revalidatePath("/admin");
  return { message: `Created ${v.email}. Share the temporary password with them securely.` };
}

const roleSchema = z.object({ userId: z.string().min(1), role: z.enum(["admin", "va", "advisor"]) });

export async function changeUserRole(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { userId, role } = parsed.data;
  if (userId === admin.id) return; // Never let the admin demote themselves out of access.

  await db.update(schema.user).set({ role }).where(eq(schema.user.id, userId));
  await audit(admin.id, "user.role_changed", "user", userId, { role });
  revalidatePath("/admin");
}

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z.object({ userId: z.string().min(1), password }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await setUserPassword(db, parsed.data.userId, parsed.data.password);
  // Sign them out everywhere so the old password's sessions end.
  await db.delete(schema.session).where(eq(schema.session.userId, parsed.data.userId));
  await audit(admin.id, "user.password_reset", "user", parsed.data.userId);
  return { message: "Password reset. They've been signed out of all sessions." };
}

// ─── Advisors ───────────────────────────────────────────────────────────

const createAdvisorSchema = z.object({
  name: z.string().trim().min(1, "Advisor name is required").max(120),
  firm: z.string().trim().max(160).optional().default(""),
  loginUserId: z.string().optional().default(""),
});

export async function createAdvisor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = createAdvisorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const v = parsed.data;

  if (v.loginUserId) {
    const [linked] = await db
      .select({ id: schema.advisors.id })
      .from(schema.advisors)
      .where(eq(schema.advisors.userId, v.loginUserId));
    if (linked) return { error: "That login is already linked to another advisor." };
  }

  const [created] = await db
    .insert(schema.advisors)
    .values({ name: v.name, firm: v.firm || null, userId: v.loginUserId || null })
    .returning();
  await audit(admin.id, "advisor.created", "advisor", created.id, { name: v.name });

  revalidatePath("/admin");
  revalidatePath("/advisors");
  return { message: `Created ${v.name}. Open their settings to build the ICP.` };
}

// ─── VA assignments ─────────────────────────────────────────────────────

export async function saveAssignments(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const advisorIds = formData.getAll("advisorIds").map(String);
  if (!z.array(z.uuid()).safeParse(advisorIds).success) return { error: "Invalid advisor selection." };

  const [va] = await db.select().from(schema.user).where(eq(schema.user.id, userId));
  if (!va || va.role !== "va") return { error: "Assignments are only for VA accounts." };

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.advisorAssignments)
      .where(
        advisorIds.length
          ? and(eq(schema.advisorAssignments.userId, userId), notInArray(schema.advisorAssignments.advisorId, advisorIds))
          : eq(schema.advisorAssignments.userId, userId),
      );
    if (advisorIds.length) {
      const existing = await tx
        .select({ id: schema.advisors.id })
        .from(schema.advisors)
        .where(inArray(schema.advisors.id, advisorIds));
      if (existing.length) {
        await tx
          .insert(schema.advisorAssignments)
          .values(existing.map((a) => ({ userId, advisorId: a.id })))
          .onConflictDoNothing();
      }
    }
  });
  await audit(admin.id, "va.assignments_updated", "user", userId, { advisorIds });

  revalidatePath("/admin");
  return { message: `Saved ${advisorIds.length} advisor${advisorIds.length === 1 ? "" : "s"} for ${va.name}.` };
}
