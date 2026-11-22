/**
 * Read-only access for the marketing analyst (Claude), spec 05.
 * The key is shown once; only its SHA-256 is stored. Lead PII never leaves through this access.
 */
import { createHash, randomBytes } from "node:crypto";

export const AGENT_KEY_PREFIX = "clab_";

export function generateAgentKey(): string {
  return AGENT_KEY_PREFIX + randomBytes(32).toString("base64url");
}

export function hashAgentKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Reads the key from `x-agent-key` or `Authorization: Bearer ...`. */
export function readAgentKey(get: (name: string) => string | null): string | null {
  const direct = get("x-agent-key")?.trim();
  const bearer = get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const key = direct || bearer || null;
  return key && key.startsWith(AGENT_KEY_PREFIX) && key.length >= 40 ? key : null;
}

/** Form fields that identify a person. Dropped from every answer the analyst receives. */
const PII_FIELD = /(^|_)(name|full_name|first_name|last_name|phone|phone_number|email|street|address|street_address)($|_)/i;

export type FormAnswer = { name: string; values: string[] };

export function answersWithoutPii(answers: unknown): FormAnswer[] {
  if (!Array.isArray(answers)) return [];
  return answers.flatMap((a) => {
    if (!a || typeof a !== "object") return [];
    const { name, values } = a as { name?: unknown; values?: unknown };
    if (typeof name !== "string" || PII_FIELD.test(name)) return [];
    return [{ name, values: Array.isArray(values) ? values.map(String) : [] }];
  });
}

/** Normalized ad text and media, from the Meta ad creative (spec 05). */
export type CreativeText = {
  title: string | null;
  body: string | null;
  description: string | null;
  cta: string | null;
  link: string | null;
  imageUrl: string | null;
  videoId: string | null;
  /** Extra versions when the ad uses dynamic creative (several texts/titles). */
  bodies: string[];
  titles: string[];
};

type Texts = { text?: string }[] | undefined;
type LinkData = { message?: string; name?: string; description?: string; link?: string; picture?: string; call_to_action?: { type?: string; value?: { link?: string } } };
type VideoData = { message?: string; title?: string; link_description?: string; image_url?: string; video_id?: string; call_to_action?: { type?: string; value?: { link?: string } } };
export type RawCreative = {
  title?: string;
  body?: string;
  call_to_action_type?: string;
  image_url?: string;
  video_id?: string;
  thumbnail_url?: string;
  object_story_spec?: { link_data?: LinkData; video_data?: VideoData };
  asset_feed_spec?: { bodies?: Texts; titles?: Texts; descriptions?: Texts; link_urls?: { website_url?: string }[]; call_to_action_types?: string[]; videos?: { video_id?: string }[] };
};

const texts = (list: Texts) => [...new Set((list ?? []).map((t) => t.text?.trim()).filter((t): t is string => !!t))];
const first = (...v: (string | undefined | null)[]) => v.find((x) => typeof x === "string" && x.trim() !== "")?.trim() ?? null;

export function creativeText(c: RawCreative | undefined | null): CreativeText | null {
  if (!c) return null;
  const link = c.object_story_spec?.link_data;
  const video = c.object_story_spec?.video_data;
  const feed = c.asset_feed_spec;
  const bodies = texts(feed?.bodies);
  const titles = texts(feed?.titles);
  const out: CreativeText = {
    title: first(c.title, link?.name, video?.title, titles[0]),
    body: first(c.body, link?.message, video?.message, bodies[0]),
    description: first(link?.description, video?.link_description, texts(feed?.descriptions)[0]),
    cta: first(c.call_to_action_type, link?.call_to_action?.type, video?.call_to_action?.type, feed?.call_to_action_types?.[0]),
    link: first(link?.link, link?.call_to_action?.value?.link, video?.call_to_action?.value?.link, feed?.link_urls?.[0]?.website_url),
    imageUrl: first(c.image_url, link?.picture, video?.image_url, c.thumbnail_url),
    videoId: first(c.video_id, video?.video_id, feed?.videos?.[0]?.video_id),
    bodies,
    titles,
  };
  const empty = !out.title && !out.body && !out.description && !out.imageUrl && !out.videoId;
  return empty ? null : out;
}
