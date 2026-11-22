"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { BRAND_COOKIE, requireUser } from "@/lib/session";

export async function signOut() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}

/** Switches the active brand. The id is checked against the user's workspace. */
export async function selectBrand(data: FormData) {
  const user = await requireUser();
  const brandId = String(data.get("brandId") ?? "");
  const brand = await db().brand.findFirst({ where: { id: brandId, workspaceId: user.workspaceId } });
  if (brand) {
    (await cookies()).set(BRAND_COOKIE, brand.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  revalidatePath("/", "layout");
}
