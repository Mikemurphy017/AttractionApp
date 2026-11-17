"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

/**
 * Free-text chips (titles, industries, metros). Submits one hidden input per
 * value under `name`, read server-side with formData.getAll(name).
 */
export function TagInput({
  name,
  defaultValue = [],
  placeholder,
  label,
}: {
  name: string;
  defaultValue?: string[];
  placeholder?: string;
  /** Accessible name for the text box. */
  label: string;
}) {
  const [values, setValues] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const parts = raw
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setValues((prev) => {
      const seen = new Set(prev.map((v) => v.toLowerCase()));
      return [...prev, ...parts.filter((p) => !seen.has(p.toLowerCase()))];
    });
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pr-1 pl-2.5 text-sm dark:bg-zinc-800"
            >
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => setValues((prev) => prev.filter((x) => x !== v))}
                className="rounded-full px-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              >
                ×
              </button>
              <input type="hidden" name={name} value={v} />
            </li>
          ))}
        </ul>
      )}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && values.length) {
            setValues((prev) => prev.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (/[,\n]/.test(text)) {
            e.preventDefault();
            add(text);
          }
        }}
        placeholder={placeholder ?? "Type and press Enter"}
        aria-label={`Add ${label.toLowerCase()}`}
        className={inputClass}
      />
    </div>
  );
}
