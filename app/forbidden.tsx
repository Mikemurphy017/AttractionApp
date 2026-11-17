import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">No access</h1>
      <p className="text-zinc-600 dark:text-zinc-400">Your account doesn&apos;t have access to this page.</p>
      <Link href="/" className="text-sm font-medium underline">
        Go home
      </Link>
    </main>
  );
}
