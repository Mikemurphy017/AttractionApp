import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireUser } from "@/lib/authz";
import { ROLE_LABELS } from "@/lib/constants";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/" className="font-semibold tracking-tight">
              Attractio
            </Link>
            {user.role === "admin" && (
              <Link href="/admin" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                Admin
              </Link>
            )}
            <Link href="/advisors" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Advisors
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-500 sm:inline">
              {user.name} · {ROLE_LABELS[user.role]}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
