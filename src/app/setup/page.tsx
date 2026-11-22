import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AuthShell } from "../ui";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await db().user.count()) > 0) redirect("/login");
  return (
    <AuthShell title="Primeiro acesso" subtitle="Crie a conta do dono desta instalação. Só é possível uma vez.">
      <SetupForm />
    </AuthShell>
  );
}
