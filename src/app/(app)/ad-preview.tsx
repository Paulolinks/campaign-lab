import { feedTruncate } from "@/domain/ad-delivery";

export type Placement = "fb" | "ig" | "story";

export type PreviewAd = {
  brandName: string;
  domain: string | null;
  primaryText: string;
  headline: string;
  description: string | null;
  cta: string;
  hook: string;
  media: { id: string; kind: string } | null;
};

const titleCase = (v: string) => v.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const host = (d: string | null) => (d ? d.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "seusite.com");
const handle = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");

function Avatar({ name, size = 40, ring = false }: { name: string; size?: number; ring?: boolean }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full bg-[#0d4f8b] font-bold text-white ${ring ? "ring-2 ring-[#d6249f] ring-offset-2 ring-offset-white" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials}
    </div>
  );
}

/** The creative: the real uploaded file, or a placeholder that shows the hook like a video cover. */
function Media({ ad, className }: { ad: PreviewAd; className: string }) {
  if (ad.media?.kind === "IMAGE")
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/media/${ad.media.id}`} alt="" className={`${className} object-cover`} />
    );
  if (ad.media?.kind === "VIDEO") return <video src={`/api/media/${ad.media.id}#t=0.5`} controls preload="metadata" className={`${className} bg-black object-cover`} />;
  return (
    <div className={`${className} relative grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#3d5a73,#16212e_70%)] px-6 text-center text-white`}>
      <div>
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-white/20 text-xl">▶</div>
        <div className="text-[15px] font-bold leading-snug">“{ad.hook}”</div>
        <div className="mt-3 inline-block rounded-full bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide">Vídeo ainda não enviado</div>
      </div>
    </div>
  );
}

function FacebookFeed({ ad }: { ad: PreviewAd }) {
  const t = feedTruncate(ad.primaryText);
  return (
    <div className="w-[400px] max-w-full overflow-hidden rounded-lg bg-white font-[system-ui] text-[15px] text-[#050505] shadow-lg">
      <div className="flex items-center gap-2 px-4 pt-3">
        <Avatar name={ad.brandName} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[15px] font-semibold">{ad.brandName}</div>
          <div className="text-[13px] text-[#65676b]">Sponsored · 🌐</div>
        </div>
        <div className="text-xl text-[#65676b]">···</div>
      </div>
      <p className="whitespace-pre-line px-4 py-2 leading-[1.34]">
        {t.shown}
        {t.cut && <span className="font-semibold text-[#65676b]">… See more</span>}
      </p>
      <Media ad={ad} className="aspect-[4/5] w-full" />
      <div className="flex items-center justify-between gap-3 bg-[#f0f2f5] px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] uppercase text-[#65676b]">{host(ad.domain)}</div>
          <div className="truncate text-[17px] font-semibold leading-tight">{ad.headline}</div>
          {ad.description && <div className="truncate text-[14px] text-[#65676b]">{ad.description}</div>}
        </div>
        <div className="shrink-0 rounded-md bg-[#e2e5e9] px-3 py-2 text-[15px] font-semibold">{titleCase(ad.cta)}</div>
      </div>
      <div className="mx-4 flex justify-around border-t border-[#ced0d4] py-1.5 text-[15px] font-semibold text-[#65676b]">
        <span>👍 Like</span>
        <span>💬 Comment</span>
        <span>↗ Share</span>
      </div>
    </div>
  );
}

function InstagramFeed({ ad }: { ad: PreviewAd }) {
  const t = feedTruncate(ad.primaryText, 90);
  return (
    <div className="w-[380px] max-w-full overflow-hidden rounded-lg bg-white font-[system-ui] text-[14px] text-[#000] shadow-lg">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar name={ad.brandName} size={32} ring />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[14px] font-semibold">{handle(ad.brandName)}</div>
          <div className="text-[12px]">Sponsored</div>
        </div>
        <div className="text-lg">···</div>
      </div>
      <Media ad={ad} className="aspect-[4/5] w-full" />
      <div className="flex items-center justify-between border-b border-[#efefef] px-3 py-3 text-[14px] font-semibold text-[#0095f6]">
        <span>{titleCase(ad.cta)}</span>
        <span>›</span>
      </div>
      <div className="flex gap-4 px-3 pt-2.5 text-[22px] leading-none">
        <span>♡</span>
        <span>💬</span>
        <span>➤</span>
        <span className="ml-auto">⌑</span>
      </div>
      <p className="px-3 pb-3 pt-2 leading-snug">
        <span className="font-semibold">{handle(ad.brandName)}</span> {t.shown}
        {t.cut && <span className="text-[#737373]">… more</span>}
      </p>
    </div>
  );
}

function Story({ ad }: { ad: PreviewAd }) {
  const t = feedTruncate(ad.primaryText, 80);
  return (
    <div className="relative aspect-[9/16] w-[300px] max-w-full overflow-hidden rounded-2xl bg-black font-[system-ui] text-white shadow-lg">
      <Media ad={ad} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-3">
        <div className="mb-2 h-0.5 rounded bg-white/40">
          <div className="h-full w-1/3 rounded bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <Avatar name={ad.brandName} size={30} />
          <div className="text-[13px] font-semibold leading-tight">
            {handle(ad.brandName)}
            <div className="text-[11px] font-normal opacity-80">Sponsored</div>
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pb-5 pt-16 text-center">
        <p className="mb-3 text-left text-[13px] leading-snug">
          {t.shown}
          {t.cut && "…"}
        </p>
        <div className="text-lg leading-none">⌃</div>
        <div className="mx-auto mt-1 inline-block rounded-full bg-white px-5 py-2 text-[14px] font-semibold text-black">{titleCase(ad.cta)}</div>
      </div>
    </div>
  );
}

export const PLACEMENTS: { key: Placement; label: string }[] = [
  { key: "fb", label: "Feed do Facebook" },
  { key: "ig", label: "Feed do Instagram" },
  { key: "story", label: "Stories e Reels" },
];

export function AdPreview({ ad, placement = "fb" }: { ad: PreviewAd; placement?: Placement }) {
  if (placement === "ig") return <InstagramFeed ad={ad} />;
  if (placement === "story") return <Story ad={ad} />;
  return <FacebookFeed ad={ad} />;
}
