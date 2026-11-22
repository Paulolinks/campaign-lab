/** Accepts "120", "120.5", "120.50" or "120,50"; blank → null. Returns undefined when invalid. */
export function parseMoneyInput(raw: string): string | null | undefined {
  const v = raw.trim().replace(",", ".");
  if (v === "") return null;
  return /^\d{1,8}(\.\d{1,2})?$/.test(v) ? v : undefined;
}
