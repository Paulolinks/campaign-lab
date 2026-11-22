import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export async function audit(entry: {
  workspaceId: string;
  userId: string;
  brandId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  data?: Prisma.InputJsonValue;
}) {
  await db().auditLog.create({ data: entry });
}
