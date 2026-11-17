"use client";

import { useActionState } from "react";
import { TagInput } from "@/components/tag-input";
import { Badge, Button, Card, Field, FormMessage, inputClass } from "@/components/ui";
import { SENIORITY_OPTIONS, US_TIMEZONES } from "@/lib/constants";
import { saveAdvisorSettings, type ActionState } from "./actions";

type Advisor = {
  id: string;
  name: string;
  firm: string;
  niche: string;
  targetTitles: string[];
  seniority: string[];
  industries: string[];
  geography: string[];
  aumMinimum: number | null;
  dailyQuota: number;
  timezone: string;
  complianceNotes: string;
  active: boolean;
};

type SignalTypeRow = {
  key: string;
  label: string;
  source: string;
  defaultWeight: number;
  isGate: boolean;
  override: number | null;
};

export function SettingsForm({ advisor, signalTypes }: { advisor: Advisor; signalTypes: SignalTypeRow[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveAdvisorSettings.bind(null, advisor.id),
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <Card title="Profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Advisor name">
            <input name="name" defaultValue={advisor.name} required className={inputClass} />
          </Field>
          <Field label="Firm">
            <input name="firm" defaultValue={advisor.firm} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Niche" hint="Who this advisor serves best, in one line.">
              <input name="niche" defaultValue={advisor.niche} className={inputClass} />
            </Field>
          </div>
        </div>
      </Card>

      <Card
        title="Ideal client profile"
        description="The gate: prospects outside this profile are dropped before scoring."
      >
        <div className="flex flex-col gap-5">
          <Field group label="Target titles" hint="Press Enter after each title. Pasting a comma-separated list works too.">
            <TagInput label="Target titles" name="targetTitles" defaultValue={advisor.targetTitles} placeholder="e.g. CFO" />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Seniority</legend>
            <div className="flex flex-wrap gap-2">
              {SENIORITY_OPTIONS.map((s) => (
                <label
                  key={s.value}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm has-checked:border-zinc-900 has-checked:bg-zinc-900 has-checked:text-white dark:border-zinc-700 dark:has-checked:border-zinc-100 dark:has-checked:bg-zinc-100 dark:has-checked:text-zinc-900"
                >
                  <input
                    type="checkbox"
                    name="seniority"
                    value={s.value}
                    defaultChecked={advisor.seniority.includes(s.value)}
                    className="sr-only"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>

          <Field group label="Industries">
            <TagInput label="Industries" name="industries" defaultValue={advisor.industries} placeholder="e.g. Software" />
          </Field>

          <Field group label="Geography" hint="US metros or states. US prospects only in the MVP.">
            <TagInput label="Geography" name="geography" defaultValue={advisor.geography} placeholder="e.g. Greater Boston" />
          </Field>

          <Field label="Minimum investable assets (USD)">
            <input
              name="aumMinimum"
              inputMode="numeric"
              defaultValue={advisor.aumMinimum != null ? advisor.aumMinimum.toLocaleString("en-US") : ""}
              placeholder="1,000,000"
              className={`${inputClass} sm:max-w-xs`}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Signal weights"
        description="How much each signal adds to the rule score (0 to 1). Leave blank to use the Bluestone default."
      >
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {signalTypes.map((s) => (
            <li key={s.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-zinc-500">{s.source}</p>
              </div>
              {s.isGate ? (
                <Badge>Gate: must pass</Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    name={`weight.${s.key}`}
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    defaultValue={s.override ?? ""}
                    placeholder={s.defaultWeight.toFixed(2)}
                    aria-label={`Weight for ${s.label}`}
                    className={`${inputClass} w-24 text-right`}
                  />
                  <span className="w-24 whitespace-nowrap text-xs text-zinc-500">default {s.defaultWeight.toFixed(2)}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Delivery">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Daily quota" hint="Prospects per day (default 25).">
            <input
              name="dailyQuota"
              type="number"
              min={1}
              max={100}
              defaultValue={advisor.dailyQuota}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Time zone" hint="The list arrives at 6 AM here.">
            <select name="timezone" defaultValue={advisor.timezone} className={inputClass}>
              {US_TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} ({t.value})
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 self-center pt-5 text-sm font-medium">
            <input type="checkbox" name="active" defaultChecked={advisor.active} className="size-4" />
            Active (include in nightly run)
          </label>
        </div>
      </Card>

      <Card
        title="Compliance notes"
        description="Firm rules the message engine must respect, e.g. required disclosures or pre-approval."
      >
        <textarea
          name="complianceNotes"
          defaultValue={advisor.complianceNotes}
          rows={4}
          className={inputClass}
        />
      </Card>

      <div className="sticky bottom-0 flex items-center gap-4 border-t border-zinc-200 bg-zinc-50/90 py-4 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
