/** Result of a form server action: a message to show, or nothing yet. */
export type ActionState = { ok?: string; error?: string } | null;

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Algo deu errado. Tente de novo.";
}
