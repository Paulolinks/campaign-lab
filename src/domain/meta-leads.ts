/**
 * Pure helpers for leads coming from Meta Lead Ads forms (spec 04, US-5): reading the form answers into the
 * fields of our Lead. No network and no database here.
 */

export type FieldData = { name?: string; values?: string[] }[];

export type MetaLeadFields = {
  name: string;
  phone: string | null;
  email: string | null;
  zip: string | null;
};

const first = (data: FieldData, ...names: string[]) => {
  for (const n of names) {
    const v = data.find((f) => f.name?.toLowerCase() === n)?.values?.[0]?.trim();
    if (v) return v;
  }
  return null;
};

/** Standard Meta form keys (full_name, phone_number, email, zip_code…) → our lead fields. Custom questions stay in formAnswers. */
export function leadFieldsFromForm(data: FieldData | null | undefined): MetaLeadFields {
  const d = data ?? [];
  const joined = [first(d, "first_name"), first(d, "last_name")].filter(Boolean).join(" ");
  const name = first(d, "full_name", "name") ?? (joined || null);
  const email = first(d, "email", "work_email");
  const phone = first(d, "phone_number", "phone", "work_phone_number");
  return {
    name: name ?? email ?? phone ?? "Lead da Meta (sem nome)",
    phone,
    email: email ? email.toLowerCase() : null,
    zip: first(d, "zip_code", "post_code", "zip", "postal_code"),
  };
}

/** Form answers as label → answer, for showing on the lead (Meta keys like "what_service_do_you_need?" become readable). */
export function readableAnswers(data: FieldData | null | undefined): { question: string; answer: string }[] {
  return (data ?? [])
    .filter((f) => f.name && f.values?.length)
    .map((f) => ({
      question: f.name!.replace(/[_?]+/g, " ").trim().replace(/^\w/, (c) => c.toUpperCase()),
      answer: f.values!.join(", "),
    }));
}

/** Unix seconds for the Meta `time_created` filter. */
export function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
