"use client";

import { useActionState, useRef } from "react";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/lib/db/schema";
import {
  changeUserRole,
  createAdvisor,
  createUser,
  resetPassword,
  saveAssignments,
  type ActionState,
} from "./actions";

export function CreateUserForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await createUser(prev, fd);
    if (result?.message) ref.current?.reset();
    return result;
  }, null);

  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <Field label="Name">
        <input name="name" required className={inputClass} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required className={inputClass} />
      </Field>
      <Field label="Role">
        <select name="role" defaultValue="va" className={inputClass}>
          <option value="va">VA</option>
          <option value="advisor">Advisor</option>
          <option value="admin">Admin</option>
        </select>
      </Field>
      <Field label="Temporary password">
        <input name="password" type="text" minLength={10} required autoComplete="off" className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create user"}
      </Button>
      <div className="sm:col-span-2 lg:col-span-5">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function CreateAdvisorForm({ logins }: { logins: { id: string; label: string }[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await createAdvisor(prev, fd);
    if (result?.message) ref.current?.reset();
    return result;
  }, null);

  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      <Field label="Advisor name">
        <input name="name" required className={inputClass} />
      </Field>
      <Field label="Firm">
        <input name="firm" className={inputClass} />
      </Field>
      <Field label="Advisor login (optional)">
        <select name="loginUserId" defaultValue="" className={inputClass}>
          <option value="">No login (VA-managed)</option>
          {logins.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add advisor"}
      </Button>
      <div className="sm:col-span-2 lg:col-span-4">
        <FormMessage state={state} />
        {logins.length === 0 && (
          <p className="text-xs text-zinc-500">
            To give an advisor their own login, first create a user with the Advisor role under Team.
          </p>
        )}
      </div>
    </form>
  );
}

export function AssignmentsForm({
  va,
  advisors,
  assigned,
}: {
  va: { id: string; name: string; email: string };
  advisors: { id: string; name: string }[];
  assigned: string[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAssignments, null);
  return (
    <form action={action} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <input type="hidden" name="userId" value={va.id} />
      <div>
        <p className="text-sm font-medium">{va.name}</p>
        <p className="text-xs text-zinc-500">{va.email}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {advisors.map((a) => (
          <label
            key={a.id}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-300 px-2.5 py-1 text-sm has-checked:border-zinc-900 has-checked:bg-zinc-900 has-checked:text-white dark:border-zinc-700 dark:has-checked:border-zinc-100 dark:has-checked:bg-zinc-100 dark:has-checked:text-zinc-900"
          >
            <input type="checkbox" name="advisorIds" value={a.id} defaultChecked={assigned.includes(a.id)} className="sr-only" />
            {a.name}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function RoleSelect({ userId, role }: { userId: string; role: UserRole }) {
  return (
    <form action={changeUserRole}>
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={role}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Role"
        className={`${inputClass} w-32 py-1`}
      >
        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await resetPassword(prev, fd);
    if (result?.message) ref.current?.reset();
    return result;
  }, null);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex gap-2">
        <input
          name="password"
          type="text"
          minLength={10}
          required
          placeholder="New password"
          autoComplete="off"
          aria-label="New password"
          className={`${inputClass} w-40 py-1`}
        />
        <Button type="submit" variant="secondary" disabled={pending} className="py-1">
          Set
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
