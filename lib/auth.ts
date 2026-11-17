import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/lib/db";

/**
 * Email + password auth. Self-signup is disabled: single-tenant MVP, so the
 * admin creates every account from the Admin screen (see lib/users.ts).
 */
export const auth = betterAuth({
  appName: "Attractio",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "advisor", input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  plugins: [nextCookies()], // must stay last
});
