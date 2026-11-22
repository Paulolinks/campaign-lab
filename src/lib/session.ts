import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { WorkspaceRole } from "@/generated/prisma/client";
import { getAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export const BRAND_COOKIE = "brand";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
};

/** The logged-in user and their workspace, or a redirect to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const membership = await db().workspaceMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new Error(`User ${session.user.id} has no workspace`);
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    workspaceId: membership.workspaceId,
    role: membership.role,
  };
}

const WRITE_ROLES: WorkspaceRole[] = ["OWNER", "EDITOR"];

export async function requireEditor(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!WRITE_ROLES.includes(user.role)) throw new Error("Sem permissão para alterar dados.");
  return user;
}

/** Brands of the workspace and the one currently selected (cookie), or null if none exist. */
export async function getBrandContext(user: CurrentUser) {
  const brands = await db().brand.findMany({
    where: { workspaceId: user.workspaceId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, currency: true, timezone: true },
  });
  const selectedId = (await cookies()).get(BRAND_COOKIE)?.value;
  const brand = brands.find((b) => b.id === selectedId) ?? brands[0] ?? null;
  return { brands, brand };
}

/** Selected brand, or a redirect to brand creation when the workspace has none. */
export async function requireBrand() {
  const user = await requireUser();
  const { brands, brand } = await getBrandContext(user);
  if (!brand) redirect("/brands?new=1");
  return { user, brands, brand };
}

/** Loads a brand by id only if it belongs to the user's workspace (never trust ids from the client). */
export async function requireOwnedBrand(user: CurrentUser, brandId: string) {
  const brand = await db().brand.findFirst({ where: { id: brandId, workspaceId: user.workspaceId } });
  if (!brand) notFound();
  return brand;
}
