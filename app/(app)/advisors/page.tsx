import { asc, inArray } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { accessibleAdvisorIds, requireUser } from "@/lib/authz";
import { db, schema } from "@/lib/db";

export default async function AdvisorsPage() {
  const user = await requireUser();
  const ids = await accessibleAdvisorIds(user);

  const advisors =
    ids === "all"
      ? await db.select().from(schema.advisors).orderBy(asc(schema.advisors.name))
      : ids.length
        ? await db
            .select()
            .from(schema.advisors)
            .where(inArray(schema.advisors.id, ids))
            .orderBy(asc(schema.advisors.name))
        : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Advisors</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {user.role === "va"
            ? "The advisors you work with. Pick one to manage their settings."
            : "Pick an advisor to manage their settings."}
        </p>
      </div>

      {advisors.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No advisors assigned to you yet. Ask your Bluestone admin to assign some.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {advisors.map((a) => (
            <li key={a.id}>
              <Link
                href={`/advisors/${a.id}/settings`}
                className="flex h-full flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{a.name}</p>
                    <p className="text-sm text-zinc-500">{a.firm ?? "No firm set"}</p>
                  </div>
                  {!a.active && <Badge tone="amber">Paused</Badge>}
                </div>
                {a.niche && <p className="text-sm text-zinc-700 dark:text-zinc-300">{a.niche}</p>}
                <p className="mt-auto text-xs text-zinc-500">
                  {a.dailyQuota}/day · {a.geography.slice(0, 3).join(" · ") || "No geography set"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
