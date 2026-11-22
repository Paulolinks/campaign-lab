/** Builds a landing URL with UTM parameters. Never put personal data (phone, email) in UTMs. */
export type UtmParams = {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  id?: string;
};

export function slugifyUtm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Returns null when the base URL is a template ({{...}}) or not a valid http(s) URL. */
export function buildUtmUrl(baseUrl: string, p: UtmParams): string | null {
  if (/\{\{.*\}\}/.test(baseUrl)) return null;
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.searchParams.set("utm_source", slugifyUtm(p.source));
  url.searchParams.set("utm_medium", slugifyUtm(p.medium));
  url.searchParams.set("utm_campaign", slugifyUtm(p.campaign));
  if (p.content) url.searchParams.set("utm_content", slugifyUtm(p.content));
  if (p.id) url.searchParams.set("utm_id", p.id.toLowerCase());
  return url.toString();
}

/** utm_source / utm_medium convention per platform (kept fixed during a test). */
export function utmSourceMedium(platform: string): { source: string; medium: string } {
  switch (platform) {
    case "META":
      return { source: "facebook", medium: "paid_social" };
    case "INSTAGRAM_ORGANIC":
      return { source: "instagram", medium: "social" };
    case "GOOGLE_ADS":
      return { source: "google", medium: "cpc" };
    default:
      return { source: platform.toLowerCase(), medium: "social" };
  }
}
