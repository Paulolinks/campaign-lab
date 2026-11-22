import { NextResponse } from "next/server";
import { buildAiTemplate } from "@/domain/ai-template";
import { slugify } from "@/domain/slug";
import { db } from "@/lib/db";
import { getBrandContext, requireUser } from "@/lib/session";

/** Downloads the AI template (CSCAMP/1 framework) personalized for the active brand. */
export async function GET() {
  const user = await requireUser();
  const { brand: active } = await getBrandContext(user);
  if (!active) return NextResponse.json({ error: "Crie uma marca primeiro." }, { status: 400 });

  const brand = await db().brand.findUniqueOrThrow({ where: { id: active.id } });
  // Latest version, preferring an approved one.
  const persona =
    (await db().personaVersion.findFirst({ where: { brandId: brand.id, approved: true }, orderBy: { createdAt: "desc" } })) ??
    (await db().personaVersion.findFirst({ where: { brandId: brand.id }, orderBy: { createdAt: "desc" } }));

  const text = buildAiTemplate({
    name: brand.name,
    industry: brand.industry,
    serviceArea: brand.serviceArea,
    forbiddenTerms: brand.forbiddenTerms,
    persona: persona ? { name: persona.name, content: persona.content } : null,
  });
  const fileName = `modelo-campanha-${slugify(brand.name) || "marca"}.txt`;
  return new Response("﻿" + text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
