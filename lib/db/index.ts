import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { attractioDb?: DB; attractioPg?: postgres.Sql };

function getDb(): DB {
  if (!globalForDb.attractioDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Missing DATABASE_URL. See .env.example and README.md.");
    globalForDb.attractioPg = postgres(url, { max: 10 });
    globalForDb.attractioDb = drizzle({ client: globalForDb.attractioPg, schema });
  }
  return globalForDb.attractioDb;
}

/**
 * The database handle. Connects lazily on first use, so importing this module
 * (e.g. during `next build`) never requires DATABASE_URL.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

/** Close the pool (scripts only). */
export async function closeDb() {
  await globalForDb.attractioPg?.end();
  globalForDb.attractioPg = undefined;
  globalForDb.attractioDb = undefined;
}

export { schema };
