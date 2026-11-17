import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireAdvisorAccess } from "@/lib/authz";
import { db, schema } from "@/lib/db";
import { SettingsForm } from "./settings-form";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdvisorSettingsPage({ params }: PageProps<"/advisors/[advisorId]/settings">) {
  const { advisorId } = await params;
  if (!UUID_RE.test(advisorId)) notFound();
  await requireAdvisorAccess(advisorId);

  const [advisor] = await db.select().from(schema.advisors).where(eq(schema.advisors.id, advisorId));
  if (!advisor) notFound();

  const [signalTypes, overrides] = await Promise.all([
    db
      .select()
      .from(schema.signalTypes)
      .where(eq(schema.signalTypes.active, true))
      .orderBy(asc(schema.signalTypes.sortOrder)),
    db.select().from(schema.advisorSignalWeights).where(eq(schema.advisorSignalWeights.advisorId, advisorId)),
  ]);
  const weightByType = Object.fromEntries(overrides.map((o) => [o.signalType, o.weight]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-zinc-500">Advisor settings</p>
        <h1 className="text-2xl font-semibold tracking-tight">{advisor.name}</h1>
        {advisor.firm && <p className="text-sm text-zinc-600 dark:text-zinc-400">{advisor.firm}</p>}
      </div>
      <SettingsForm
        advisor={{
          id: advisor.id,
          name: advisor.name,
          firm: advisor.firm ?? "",
          niche: advisor.niche ?? "",
          targetTitles: advisor.targetTitles,
          seniority: advisor.seniority,
          industries: advisor.industries,
          geography: advisor.geography,
          aumMinimum: advisor.aumMinimum,
          dailyQuota: advisor.dailyQuota,
          timezone: advisor.timezone,
          complianceNotes: advisor.complianceNotes ?? "",
          active: advisor.active,
        }}
        signalTypes={signalTypes.map((s) => ({
          key: s.key,
          label: s.label,
          source: s.source,
          defaultWeight: s.defaultWeight,
          isGate: s.isGate,
          override: weightByType[s.key] ?? null,
        }))}
      />
    </div>
  );
}
