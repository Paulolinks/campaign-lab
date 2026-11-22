import "server-only";
import { createHash } from "node:crypto";
import { AD_CONTENT_KEYS, buildImportPlan, type AdInput, type ExistingVariant, type ImportPlan } from "@/domain/campaign-import";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";

/** Builds the import plan against what this brand already has. Read-only. */
export async function planImport(brandId: string, text: string): Promise<ImportPlan> {
  const brand = await db().brand.findUniqueOrThrow({ where: { id: brandId } });
  const [campaigns, variants] = await Promise.all([
    db().campaignPlan.findMany({ where: { brandId }, select: { campaignKey: true } }),
    db().adVariant.findMany({ where: { brandId }, include: { campaign: { select: { campaignKey: true } } } }),
  ]);
  const existingVariants: ExistingVariant[] = variants.map((v) => ({
    ...pickContent(v),
    adKey: v.adKey,
    campaignKey: v.campaign.campaignKey,
  }));
  return buildImportPlan({
    text,
    brandName: brand.name,
    forbiddenTerms: brand.forbiddenTerms,
    existingCampaignKeys: campaigns.map((c) => c.campaignKey),
    existingVariants,
  });
}

export type CommitResult = { batchId: string; created: number; updated: number; unchanged: number; campaignIds: string[] };

/**
 * Saves the plan as drafts in one transaction. Re-plans from the text on the server (the preview is never trusted).
 * Same AD_KEY → same variant; changed content → new version with snapshot. Nothing is published anywhere.
 */
export async function commitImport(user: CurrentUser, brandId: string, fileName: string, text: string): Promise<CommitResult | { errors: ImportPlan["errors"] }> {
  const plan = await planImport(brandId, text);
  if (!plan.ok) return { errors: plan.errors };
  const sha256 = createHash("sha256").update(text).digest("hex");

  const result = await db().$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: { brandId, fileName: fileName.slice(0, 255), sha256, status: "COMMITTED", summary: plan.totals, createdBy: user.id },
    });
    const campaignIds: string[] = [];
    for (const pc of plan.campaigns) {
      const c = pc.input;
      const campaignData = {
        name: c.name,
        persona: c.persona,
        service: c.service,
        objective: c.objective,
        hypothesis: c.hypothesis,
        channels: c.channels,
        landingUrl: c.landingUrl,
        market: c.market,
        testVariable: c.testVariable,
        ctaDestination: c.ctaDestination,
        budgetPerDay: c.budgetPerDay,
        budgetNote: c.budgetNote,
        notes: c.notes,
        extra: c.extra as Prisma.InputJsonValue,
      };
      const persona = await tx.personaVersion.findFirst({ where: { brandId, name: c.persona }, orderBy: { version: "desc" } });
      const campaign = await tx.campaignPlan.upsert({
        where: { brandId_campaignKey: { brandId, campaignKey: c.campaignKey } },
        create: { ...campaignData, brandId, campaignKey: c.campaignKey, personaVersionId: persona?.id ?? null },
        update: { ...campaignData, personaVersionId: persona?.id ?? undefined },
      });
      campaignIds.push(campaign.id);

      for (const pa of pc.ads) {
        if (pa.change === "unchanged") continue;
        const content = variantContent(pa.input);
        if (pa.change === "create") {
          const v = await tx.adVariant.create({ data: { ...content, brandId, campaignId: campaign.id, adKey: pa.input.adKey, version: 1 } });
          await tx.adVariantVersion.create({ data: { variantId: v.id, version: 1, snapshot: content as Prisma.InputJsonValue, importBatchId: batch.id, createdBy: user.id } });
        } else {
          const current = await tx.adVariant.findUniqueOrThrow({ where: { brandId_adKey: { brandId, adKey: pa.input.adKey } } });
          const version = current.version + 1;
          await tx.adVariant.update({ where: { id: current.id }, data: { ...content, version } });
          await tx.adVariantVersion.create({ data: { variantId: current.id, version, snapshot: content as Prisma.InputJsonValue, importBatchId: batch.id, createdBy: user.id } });
        }
      }
    }
    return { batchId: batch.id, campaignIds };
  });

  await audit({ workspaceId: user.workspaceId, userId: user.id, brandId, action: "import.committed", entity: "ImportBatch", entityId: result.batchId, data: plan.totals });
  return { ...result, created: plan.totals.create, updated: plan.totals.update, unchanged: plan.totals.unchanged };
}

function variantContent(ad: AdInput) {
  return {
    ...Object.fromEntries(AD_CONTENT_KEYS.map((k) => [k, ad[k]])),
    extra: ad.extra,
  } as Pick<AdInput, (typeof AD_CONTENT_KEYS)[number]> & { extra: Record<string, string> };
}

function pickContent(v: Record<string, unknown>) {
  return Object.fromEntries(AD_CONTENT_KEYS.map((k) => [k, (v[k] as string | null) ?? null])) as Pick<AdInput, (typeof AD_CONTENT_KEYS)[number]>;
}
