import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

function createAuth() {
  return betterAuth({
    secret: env("BETTER_AUTH_SECRET"),
    baseURL: env("BETTER_AUTH_URL"),
    database: prismaAdapter(db(), { provider: "postgresql" }),
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    databaseHooks: {
      user: {
        create: {
          // Owner setup: only the first account may sign up (via /setup). Team members come later.
          before: async () => (await db().user.count()) === 0,
          after: async (user) => {
            await db().workspace.create({
              data: { name: "Principal", members: { create: { userId: user.id, role: "OWNER" } } },
            });
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

const globalForAuth = globalThis as unknown as { auth?: ReturnType<typeof createAuth> };

/** Built on first use so `next build` doesn't need runtime secrets. */
export function getAuth() {
  globalForAuth.auth ??= createAuth();
  return globalForAuth.auth;
}
