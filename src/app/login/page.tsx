import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AuthShell } from "../ui";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if ((await db().user.count()) === 0) redirect("/setup");
  return (
    <AuthShell title="Entrar" subtitle="Acesse suas marcas, campanhas e resultados.">
      <LoginForm />
    </AuthShell>
  );
}
