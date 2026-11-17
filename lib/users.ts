import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { DB } from "@/lib/db";
import { schema } from "@/lib/db";
import type { UserRole } from "@/lib/db/schema";

/**
 * Creates an email + password user the same way Better Auth does
 * (a `user` row plus a `credential` account holding the password hash).
 * Self-signup is disabled, so this is the only way accounts get created.
 */
export async function createPasswordUser(
  db: DB,
  input: { email: string; name: string; role: UserRole; password: string },
) {
  const email = input.email.trim().toLowerCase();
  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.user)
      .values({ id, email, name: input.name.trim(), role: input.role, emailVerified: true })
      .returning();
    await tx.insert(schema.account).values({
      id: randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: passwordHash,
    });
    return created;
  });
}

export async function setUserPassword(db: DB, userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  await db
    .update(schema.account)
    .set({ password: passwordHash })
    .where(eq(schema.account.userId, userId));
}

export async function findUserByEmail(db: DB, email: string) {
  const [row] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email.trim().toLowerCase()));
  return row ?? null;
}
