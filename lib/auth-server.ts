import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/drizzle-schema";

export async function getAuthSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Returns the app `users` row for the signed-in coach, or null. */
export async function requireCoach() {
  const session = await getAuthSession();
  if (!session?.user) return null;

  const db = getDb();
  const [coach] = await db
    .select()
    .from(users)
    .where(eq(users.authUserId, session.user.id))
    .limit(1);

  if (coach) return { session, coach };

  // Fallback for coaches created before auth_user_id was linked.
  if (session.user.email) {
    const [byEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);
    if (byEmail) {
      if (!byEmail.authUserId) {
        await db
          .update(users)
          .set({ authUserId: session.user.id, updatedAt: new Date() })
          .where(eq(users.id, byEmail.id));
      }
      return { session, coach: { ...byEmail, authUserId: session.user.id } };
    }
  }

  return null;
}
