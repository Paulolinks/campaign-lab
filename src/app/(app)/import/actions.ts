"use server";

import { revalidatePath } from "next/cache";
import { MAX_IMPORT_BYTES } from "@/domain/cscamp-parser";
import type { ImportPlan } from "@/domain/campaign-import";
import { commitImport, planImport } from "@/lib/import-service";
import { getBrandContext, requireEditor } from "@/lib/session";

export type PreviewResponse = { plan: ImportPlan; brandName: string } | { error: string };
export type CommitResponse =
  | { ok: true; created: number; updated: number; unchanged: number; campaignIds: string[] }
  | { ok: false; error: string };

async function activeBrand() {
  const user = await requireEditor();
  const { brand } = await getBrandContext(user);
  if (!brand) throw new Error("Crie uma marca antes de importar.");
  return { user, brand };
}

function checkText(text: unknown): string {
  if (typeof text !== "string" || !text.trim()) throw new Error("Arquivo vazio.");
  if (text.length > MAX_IMPORT_BYTES) throw new Error("Arquivo muito grande (limite: 2 MB).");
  return text;
}

export async function previewImport(text: string): Promise<PreviewResponse> {
  try {
    const { brand } = await activeBrand();
    return { plan: await planImport(brand.id, checkText(text)), brandName: brand.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao ler o arquivo." };
  }
}

export async function confirmImport(fileName: string, text: string): Promise<CommitResponse> {
  try {
    const { user, brand } = await activeBrand();
    if (!/\.txt$/i.test(fileName) && fileName !== "texto-colado.txt") throw new Error("Use um arquivo .txt.");
    const result = await commitImport(user, brand.id, fileName, checkText(text));
    if ("errors" in result) return { ok: false, error: `O arquivo tem ${result.errors.length} erro(s). Corrija e pré-visualize de novo.` };
    revalidatePath("/", "layout");
    return { ok: true, created: result.created, updated: result.updated, unchanged: result.unchanged, campaignIds: result.campaignIds };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao importar." };
  }
}
