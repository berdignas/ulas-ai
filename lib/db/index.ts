import postgres from "postgres";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let _db: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set. Set it in Vercel Environment Variables.");
  }
  const client = postgres(connectionString, { prepare: false, max: 1 });
  _db = drizzle(client, { schema });
  return _db;
}

const dbProxy = {
  select: (...args: Parameters<PostgresJsDatabase<typeof schema>["select"]>) => getDb().select(...args),
  insert: (...args: Parameters<PostgresJsDatabase<typeof schema>["insert"]>) => getDb().insert(...args),
  update: (...args: Parameters<PostgresJsDatabase<typeof schema>["update"]>) => getDb().update(...args),
  delete: (...args: Parameters<PostgresJsDatabase<typeof schema>["delete"]>) => getDb().delete(...args),
  transaction: (...args: Parameters<PostgresJsDatabase<typeof schema>["transaction"]>) => getDb().transaction(...args),
  execute: (...args: Parameters<PostgresJsDatabase<typeof schema>["execute"]>) => getDb().execute(...args),
};

export const db = dbProxy as unknown as PostgresJsDatabase<typeof schema>;