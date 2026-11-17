import { asc, count, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { requireAdmin } from "@/lib/authz";
import { ROLE_LABELS } from "@/lib/constants";
import { db, schema } from "@/lib/db";
import { AssignmentsForm, CreateAdvisorForm, CreateUserForm, ResetPasswordForm, RoleSelect } from "./forms";

export default async function AdminPage() {
  const admin = await requireAdmin();

  const [users, advisors, assignments, [prospectCount], [outcomeCount], recentAudit] = await Promise.all([
    db
      .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, role: schema.user.role, createdAt: schema.user.createdAt })
      .from(schema.user)
      .orderBy(asc(schema.user.role), asc(schema.user.name)),
    db
      .select({
        id: schema.advisors.id,
        name: schema.advisors.name,
        firm: schema.advisors.firm,
        dailyQuota: schema.advisors.dailyQuota,
        timezone: schema.advisors.timezone,
        active: schema.advisors.active,
        userId: schema.advisors.userId,
        loginEmail: schema.user.email,
      })
      .from(schema.advisors)
      .leftJoin(schema.user, eq(schema.user.id, schema.advisors.userId))
      .orderBy(asc(schema.advisors.name)),
    db.select().from(schema.advisorAssignments),
    db.select({ n: count() }).from(schema.prospects),
    db.select({ n: count() }).from(schema.outcomes).where(sql`${schema.outcomes.repliedAt} is not null`),
    db
      .select({
        id: schema.auditLog.id,
        action: schema.auditLog.action,
        createdAt: schema.auditLog.createdAt,
        actor: schema.user.name,
      })
      .from(schema.auditLog)
      .leftJoin(schema.user, eq(schema.user.id, schema.auditLog.actorUserId))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(8),
  ]);

  const vas = users.filter((u) => u.role === "va");
  const linkedUserIds = new Set(advisors.map((a) => a.userId).filter(Boolean));
  const unlinkedAdvisorLogins = users.filter((u) => u.role === "advisor" && !linkedUserIds.has(u.id));
  const vasByAdvisor = new Map<string, string[]>();
  for (const a of assignments) {
    const va = vas.find((v) => v.id === a.userId);
    if (va) vasByAdvisor.set(a.advisorId, [...(vasByAdvisor.get(a.advisorId) ?? []), va.name]);
  }

  const stats = [
    { label: "Active advisors", value: advisors.filter((a) => a.active).length },
    { label: "VAs", value: vas.length },
    { label: "Prospects in database", value: prospectCount.n },
    { label: "Logged replies", value: outcomeCount.n },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Bluestone only. Manage advisors, VAs and logins. Pipeline runs, credit usage and model accuracy appear here
          in Phases 2 and 5.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <dt className="text-sm text-zinc-500">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <Card title="Advisors" description="Everyone Attractio builds a daily list for.">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-5 py-2 font-medium">Advisor</th>
                <th className="px-3 py-2 font-medium">Login</th>
                <th className="px-3 py-2 font-medium">VAs</th>
                <th className="px-3 py-2 font-medium">Quota</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {advisors.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-zinc-500">{a.firm ?? "—"}</p>
                  </td>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{a.loginEmail ?? "—"}</td>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{vasByAdvisor.get(a.id)?.join(", ") ?? "—"}</td>
                  <td className="px-3 py-3 tabular-nums">{a.dailyQuota}/day</td>
                  <td className="px-3 py-3">{a.active ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Paused</Badge>}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/advisors/${a.id}/settings`} className="font-medium underline-offset-4 hover:underline">
                      Settings
                    </Link>
                  </td>
                </tr>
              ))}
              {advisors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-zinc-500">
                    No advisors yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <h3 className="mb-3 text-sm font-semibold">Add advisor</h3>
          <CreateAdvisorForm logins={unlinkedAdvisorLogins.map((u) => ({ id: u.id, label: `${u.name} (${u.email})` }))} />
        </div>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card title="VA assignments" description="Which advisors each VA can work. VAs see only these advisors.">
          {vas.length === 0 ? (
            <p className="text-sm text-zinc-500">No VA accounts yet. Add one under Team.</p>
          ) : (
            <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
              {vas.map((va) => (
                <AssignmentsForm
                  key={va.id}
                  va={{ id: va.id, name: va.name, email: va.email }}
                  advisors={advisors.map((a) => ({ id: a.id, name: a.name }))}
                  assigned={assignments.filter((x) => x.userId === va.id).map((x) => x.advisorId)}
                />
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent activity" description="From the audit log.">
          {recentAudit.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {recentAudit.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span>
                    <span className="font-mono text-xs">{e.action}</span>
                    <span className="text-zinc-500"> · {e.actor ?? "system"}</span>
                  </span>
                  <time className="shrink-0 text-xs text-zinc-500" dateTime={e.createdAt.toISOString()}>
                    {e.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Team" description="Every login. Self-signup is off, so accounts are created here.">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-5 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-5 py-2 font-medium">Reset password</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3 font-medium">{u.name}</td>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{u.email}</td>
                  <td className="px-3 py-3">
                    {u.id === admin.id ? <Badge tone="blue">{ROLE_LABELS[u.role]} (you)</Badge> : <RoleSelect userId={u.id} role={u.role} />}
                  </td>
                  <td className="px-5 py-3">
                    <ResetPasswordForm userId={u.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <h3 className="mb-3 text-sm font-semibold">Add user</h3>
          <CreateUserForm />
        </div>
      </Card>
    </div>
  );
}
