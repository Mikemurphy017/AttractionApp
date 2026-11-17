const screens = [
  { name: "Today", phase: 3, note: "25 ranked prospect cards with why-now and signal evidence" },
  { name: "Prospect detail", phase: 3, note: "Signal timeline, TextTonality drafts, approve / reject" },
  { name: "Outcomes", phase: 5, note: "One-click Sent / Replied / Positive / Booked / Client" },
  { name: "Advisor settings", phase: 1, note: "ICP builder, quota, compliance notes, time zone" },
  { name: "Admin", phase: 2, note: "Advisors, pipeline runs, credit usage, model accuracy" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Attractio</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          25 signal-backed prospects a day, with TextTonality® drafts.
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Attractio researches and writes. It never sends: every message is copied and sent by a
          person.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Screens</h2>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {screens.map((s) => (
            <li key={s.name} className="flex items-start justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.note}</p>
              </div>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Phase {s.phase}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
