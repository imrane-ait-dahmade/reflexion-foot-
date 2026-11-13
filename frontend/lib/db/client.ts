import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./drizzle-schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  return drizzle(neon(url), { schema });
}

export type Db = ReturnType<typeof createDb>;

/** Lazy singleton so build-time imports do not require DATABASE_URL. */
let db: Db | null = null;

export function getDb() {
  if (!db) db = createDb();
  return db;
}
