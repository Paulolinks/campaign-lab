import { redirect } from "next/navigation";

/** Approval now lives in the manager (Anúncios tab, preview panel). */
export default function ApprovalsPage() {
  redirect("/manager?tab=ads");
}
