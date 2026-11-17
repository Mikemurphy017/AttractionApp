/**
 * Seeds the database. Safe to run repeatedly.
 *
 *   pnpm db:seed            reference data (signal types, cadence) + the admin account
 *   pnpm db:seed --sample   also two sample advisors, their logins and a VA
 *
 * The admin account comes from ADMIN_EMAIL / ADMIN_PASSWORD. If the user
 * already exists it is promoted to admin and its password is left alone.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  // Import after dotenv so DATABASE_URL is set.
  const { eq } = await import("drizzle-orm");
  const { db, schema, closeDb } = await import("@/lib/db");
  const { SIGNAL_TYPES, CADENCE_STEPS } = await import("@/lib/db/reference-data");
  const { createPasswordUser, findUserByEmail } = await import("@/lib/users");

  const withSample = process.argv.includes("--sample");

  // ── Reference data ──
  for (const s of SIGNAL_TYPES) {
    await db
      .insert(schema.signalTypes)
      .values(s)
      .onConflictDoUpdate({
        target: schema.signalTypes.key,
        set: { label: s.label, source: s.source, isGate: s.isGate, sortOrder: s.sortOrder },
      });
  }
  for (const c of CADENCE_STEPS) {
    await db.insert(schema.cadenceSteps).values(c).onConflictDoNothing();
  }
  console.log(`Reference data: ${SIGNAL_TYPES.length} signal types, ${CADENCE_STEPS.length} cadence steps.`);

  // ── Admin ──
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const existing = await findUserByEmail(db, adminEmail);
    if (existing) {
      await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, existing.id));
      console.log(`Admin: ${existing.email} (existing account, role set to admin).`);
    } else {
      const password = process.env.ADMIN_PASSWORD;
      if (!password || password.length < 10) {
        // Don't fail the deploy: the app works, the admin just can't sign in yet.
        console.warn(
          `WARNING: ${adminEmail} not created. Set ADMIN_PASSWORD (10+ characters) and redeploy to create the admin account.`,
        );
      } else {
        const admin = await createPasswordUser(db, {
          email: adminEmail,
          name: process.env.ADMIN_NAME ?? "Admin",
          role: "admin",
          password,
        });
        console.log(`Admin: ${admin.email} created.`);
      }
    }
  } else {
    console.log("ADMIN_EMAIL not set; skipping admin account.");
  }

  // ── Sample data (local / staging only) ──
  if (withSample) {
    const password = process.env.SEED_PASSWORD;
    if (!password || password.length < 10) {
      throw new Error("SEED_PASSWORD (10+ characters) is required for --sample.");
    }

    async function ensureUser(email: string, name: string, role: "va" | "advisor") {
      return (await findUserByEmail(db, email)) ?? createPasswordUser(db, { email, name, role, password: password! });
    }

    const samples = [
      {
        login: { email: "dana.advisor@example.com", name: "Dana Whitfield" },
        advisor: {
          name: "Dana Whitfield",
          firm: "Whitfield Wealth Partners (sample RIA)",
          niche: "Tech executives with equity compensation (RSUs, ISOs, pre-IPO shares)",
          targetTitles: ["CTO", "CFO", "VP Engineering", "VP Product", "Director of Engineering", "Chief Product Officer"],
          seniority: ["c_suite", "vp", "director"],
          industries: ["Software", "Semiconductors", "Internet", "Fintech"],
          geography: ["San Francisco Bay Area", "Greater Seattle Area", "Austin, Texas Metropolitan Area"],
          aumMinimum: 1_000_000,
          complianceNotes:
            "Independent RIA. No performance figures or testimonials. Email footer must include firm name, physical address and opt-out.",
          dailyQuota: 25,
          timezone: "America/Los_Angeles",
        },
        weights: { liquidity_event: 1.0, insider_sale: 0.9, funding_round: 0.9, company_news: 0.4 },
      },
      {
        login: { email: "marcus.advisor@example.com", name: "Marcus Reyes" },
        advisor: {
          name: "Marcus Reyes",
          firm: "Reyes Private Wealth (sample hybrid RIA)",
          niche: "Privately held business owners within 1–3 years of an exit",
          targetTitles: ["Owner", "Founder", "CEO", "President", "Managing Partner"],
          seniority: ["owner", "founder", "c_suite", "partner"],
          industries: ["Manufacturing", "Construction", "Wholesale Distribution", "Healthcare Services", "Professional Services"],
          geography: ["Dallas-Fort Worth Metroplex", "Greater Chicago Area", "Charlotte Metro"],
          aumMinimum: 3_000_000,
          complianceNotes:
            "Hybrid RIA with broker-dealer affiliation. All outreach must be reviewed and archived by firm compliance before sending.",
          dailyQuota: 25,
          timezone: "America/Chicago",
        },
        weights: { liquidity_event: 1.0, retirement_window: 0.8, job_change: 0.4 },
      },
    ];

    const advisorIds: string[] = [];
    for (const s of samples) {
      const login = await ensureUser(s.login.email, s.login.name, "advisor");
      let [adv] = await db.select().from(schema.advisors).where(eq(schema.advisors.userId, login.id));
      if (!adv) {
        [adv] = await db.insert(schema.advisors).values({ ...s.advisor, userId: login.id }).returning();
        for (const [signalType, weight] of Object.entries(s.weights)) {
          await db.insert(schema.advisorSignalWeights).values({ advisorId: adv.id, signalType, weight });
        }
      }
      advisorIds.push(adv.id);
    }

    const va = await ensureUser("va@example.com", "Sample VA", "va");
    for (const advisorId of advisorIds) {
      await db.insert(schema.advisorAssignments).values({ userId: va.id, advisorId }).onConflictDoNothing();
    }

    console.log("Sample data: 2 advisors (dana.advisor@example.com, marcus.advisor@example.com), 1 VA (va@example.com) assigned to both.");
  }

  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
