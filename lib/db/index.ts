import { supabase } from "@/lib/supabase";
import postgres from "postgres";
import { config } from "dotenv";

config({ override: true });

export { supabase };

let _sqlClient: ReturnType<typeof postgres> | null = null;

export function getSqlClient() {
  if (!_sqlClient && process.env.DATABASE_URL) {
    _sqlClient = postgres(process.env.DATABASE_URL, { prepare: false, max: 10 });
  }
  return _sqlClient;
}

// Helper to convert DB snake_case objects to app camelCase objects
export function toCamel<T = Record<string, unknown>>(obj: unknown): T {
  if (obj === null || obj === undefined) return obj as T;
  if (Array.isArray(obj)) {
    return obj.map((v) => toCamel(v)) as unknown as T;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const n: Record<string, unknown> = {};
    for (const [k, value] of Object.entries(obj)) {
      const camelKey = k.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      n[camelKey] = toCamel(value);
    }
    return n as T;
  }
  return obj as T;
}

// Helper to convert app camelCase objects to DB snake_case objects
export function toSnake<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj as T;
  if (Array.isArray(obj)) {
    return obj.map((v) => toSnake(v)) as unknown as T;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const n: Record<string, unknown> = {};
    for (const [k, value] of Object.entries(obj)) {
      const snakeKey = k.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      n[snakeKey] = toSnake(value);
    }
    return n as T;
  }
  return obj as T;
}
