import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/authz";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Attractio</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Accounts are created by your Bluestone admin.
        </p>
        <LoginForm next={safeNext} />
      </div>
    </main>
  );
}
