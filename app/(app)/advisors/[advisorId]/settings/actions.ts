"use server";

import { and, eq, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdvisorAccess } from "@/lib/authz";
import { SENIORITY_OPTIONS, US_TIMEZONES } from "@/lib/constants";
import { db, schema } from "@/lib/db";

export type ActionState = { error?: string; message?: string } | null;

const list = (max: number) => z.array(z.string().trim().min(1).max(120)).max(max);

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  firm: z.string().trim().max(160),
  niche: z.string().trim().max(500),
  targetTitles: list(50),
  seniority: z.array(z.enum(SENIORITY_OPTIONS.map((s) => s.value))).max(SENIORITY_OPTIONS.length),
  industries: list(50),
  geography: list(50),
  aumMinimum: z.number().int().min(0).max(1_000_000_000).nullable(),
  dailyQuota: z.number().int().min(1, "Quota must be at least 1").max(100, "Quota can be at most 100"),
  timezone: z.enum(US_TIMEZONES.map((t) => t.value)),
  complianceNotes: z.string().trim().max(4000),
  active: z.boolean(),
});

function parseDollars(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

export async function saveAdvisorSettings(
  advisorId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!z.uuid().safeParse(advisorId).success) return { error: "Unknown advisor." };
  const user = await requireAdvisorAccess(advisorId);

  const parsed = settingsSchema.safeParse({
    name: formData.get("name"),
    firm: formData.get("firm") ?? "",
    niche: formData.get("niche") ?? "",
    targetTitles: formData.getAll("targetTitles"),
    seniority: formData.getAll("seniority"),
    industries: formData.getAll("industries"),
    geography: formData.getAll("geography"),
    aumMinimum: parseDollars(formData.get("aumMinimum")),
    dailyQuota: Number(formData.get("dailyQuota")),
    timezone: formData.get("timezone"),
    complianceNotes: formData.get("complianceNotes") ?? "",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const v = parsed.data;

  // Signal weights: blank = use the default; otherwise 0–1.
  const signalTypes = await db.select().from(schema.signalTypes).where(eq(schema.signalTypes.isGate, false));
  const overrides: { signalType: string; weight: number }[] = [];
  for (const st of signalTypes) {
    const raw = String(formData.get(`weight.${st.key}`) ?? "").trim();
    if (!raw) continue;
    const w = Number(raw);
    if (!Number.isFinite(w) || w < 0 || w > 1) {
      return { error: `Weight for "${st.label}" must be between 0 and 1.` };
    }
    overrides.push({ signalType: st.key, weight: w });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.advisors)
      .set({
        name: v.name,
        firm: v.firm || null,
        niche: v.niche || null,
        targetTitles: v.targetTitles,
        seniority: v.seniority,
        industries: v.industries,
        geography: v.geography,
        aumMinimum: v.aumMinimum,
        dailyQuota: v.dailyQuota,
        timezone: v.timezone,
        complianceNotes: v.complianceNotes || null,
        active: v.active,
      })
      .where(eq(schema.advisors.id, advisorId));

    const keep = overrides.map((o) => o.signalType);
    await tx
      .delete(schema.advisorSignalWeights)
      .where(
        keep.length
          ? and(
              eq(schema.advisorSignalWeights.advisorId, advisorId),
              notInArray(schema.advisorSignalWeights.signalType, keep),
            )
          : eq(schema.advisorSignalWeights.advisorId, advisorId),
      );
    for (const o of overrides) {
      await tx
        .insert(schema.advisorSignalWeights)
        .values({ advisorId, ...o })
        .onConflictDoUpdate({
          target: [schema.advisorSignalWeights.advisorId, schema.advisorSignalWeights.signalType],
          set: { weight: o.weight },
        });
    }

    await tx.insert(schema.auditLog).values({
      actorUserId: user.id,
      action: "advisor.settings_updated",
      entity: "advisor",
      entityId: advisorId,
      data: { ...v, signalWeights: overrides },
    });
  });

  revalidatePath(`/advisors/${advisorId}/settings`);
  revalidatePath("/advisors");
  return { message: "Saved." };
}
