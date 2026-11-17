/**
 * Typed access to environment variables. Read lazily so a missing key fails
 * at the call site with a clear message, not at import time.
 * The full list of keys lives in .env.example.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example and README.md.`);
  }
  return value;
}

/** Safe to use in the browser (NEXT_PUBLIC_*). */
export const publicEnv = {
  // Next.js inlines NEXT_PUBLIC_* only when referenced literally, so keep these literal.
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: () =>
    required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
};

/** Server-only secrets. Never reference these from a Client Component. */
export const serverEnv = {
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  anthropicApiKey: () => required("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY),
  /** "mock" makes every data adapter return fixtures and spend no credits. */
  adapterMode: (): "mock" | "live" => (process.env.ADAPTER_MODE === "live" ? "live" : "mock"),
};
