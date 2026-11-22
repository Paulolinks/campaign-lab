import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Single Prisma client per process (survives dev hot reloads). */
export function db(): PrismaClient {
  globalForPrisma.prisma ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: env("DATABASE_URL") }) });
  return globalForPrisma.prisma;
}
