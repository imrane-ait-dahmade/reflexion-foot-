import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/drizzle-schema";

neonConfig.webSocketConstructor = ws;

function createAuthPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  return new Pool({ connectionString: url });
}

let pool: Pool | null = null;

function getAuthPool() {
  if (!pool) pool = createAuthPool();
  return pool;
}

export const auth = betterAuth({
  database: getAuthPool(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "coach",
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const db = getDb();
          const existing = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);

          if (existing.length > 0) {
            await db
              .update(users)
              .set({
                authUserId: user.id,
                displayName: user.name,
                role: "coach",
                updatedAt: new Date(),
              })
              .where(eq(users.id, existing[0].id));
            return;
          }

          await db.insert(users).values({
            email: user.email,
            displayName: user.name,
            role: "coach",
            authUserId: user.id,
          });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
