/**
 * The downloadable "framework" the user gives to ChatGPT/Claude so it writes ads in CSCAMP/1.
 * Personalized with the active brand (name, persona, forbidden terms). Pure: no I/O.
 */

export type TemplateBrand = {
  name: string;
  industry: string | null;
  serviceArea: string | null;
  forbiddenTerms: string[];
  persona: { name: string; content: string } | null;
};

export const EXAMPLE_BLOCK = `CSCAMP/1
CAMPAIGN
CAMPAIGN_KEY: BRAND-SERVICE-ANGLE-2026-11
CAMPAIGN_NAME: Service - Angle test
BRAND: {{BRAND}}
PERSONA: {{PERSONA}}
SERVICE: MAIN_SERVICE
OBJECTIVE: QUALIFIED_LEADS
TEST_HYPOTHESIS: People who value X generate more qualified leads than people attracted by price.
CHANNELS: META_PAID, INSTAGRAM_ORGANIC
LANDING_URL: https://example.com/estimate
MARKET: City / region served
TEST_VARIABLE: MESSAGE_ANGLE
CTA_DESTINATION: WEBSITE_ESTIMATE_FORM
BUDGET_USD_PER_DAY: TBD
NOTES: <<<
Notes for the team (not shown to customers).
>>>
AD
AD_KEY: BRAND-SERVICE-ANGLE-2026-11-A01
AD_NAME: A01 - Short internal name
ANGLE: INSTALLATION_QUALITY
FORMAT: VIDEO_9_16
FUNNEL_STAGE: CONSIDERATION
HOOK: First sentence that stops the scroll.
PRIMARY_TEXT: <<<
Main ad text. Can have
several lines.
>>>
HEADLINE: Short headline
DESCRIPTION: Short description
CTA: REQUEST_ESTIMATE
VISUAL_DIRECTION: What the image/video must show.
IMAGE_PROMPT: Prompt to generate the image (optional).
VIDEO_SCRIPT: <<<
SCENE 01 | HOOK: "..."
SCENE 02 | PROBLEM: "..."
SCENE 03 | VALUE: "..."
SCENE 04 | CTA: "..."
>>>
NOTES: Anything to check before publishing.
END_AD
END_CAMPAIGN`;

export function buildAiTemplate(brand: TemplateBrand): string {
  const persona = brand.persona?.name ?? "NOME_DA_PERSONA";
  const forbidden = brand.forbiddenTerms.length
    ? brand.forbiddenTerms.map((t) => `- ${t}`).join("\n")
    : "- (nenhum termo cadastrado para esta marca)";
  const example = EXAMPLE_BLOCK.replace("{{BRAND}}", brand.name).replace("{{PERSONA}}", persona);

  return `MODELO DE CAMPANHA PARA IA — formato CSCAMP/1
Marca: ${brand.name}${brand.industry ? ` (${brand.industry})` : ""}${brand.serviceArea ? ` — área: ${brand.serviceArea}` : ""}

============================================================
COMO USAR (para você)
============================================================
1. Envie este arquivo inteiro para o ChatGPT ou o Claude.
2. Diga o que quer, por exemplo: "Crie uma campanha com 3 anúncios para instalação de mini split, testando 3 ângulos".
3. Salve a resposta da IA num arquivo .txt (ou copie o texto).
4. No app, vá em Importar TXT, escolha o arquivo e clique em Pré-visualizar.
   O app organiza cada campanha e cada anúncio no lugar certo. Nada é publicado.

============================================================
INSTRUÇÕES PARA A IA
============================================================
Você vai escrever campanhas de anúncios para a marca "${brand.name}".
Responda SOMENTE com o conteúdo do arquivo, começando pela linha CSCAMP/1. Sem explicações antes ou depois.

Regras do formato:
- A primeira linha é exatamente: CSCAMP/1
- Cada campanha fica entre CAMPAIGN e END_CAMPAIGN. Pode haver mais de uma campanha no arquivo.
- Cada anúncio fica entre AD e END_AD, dentro da campanha.
- Um campo por linha, no formato CAMPO: valor (nome do campo em MAIÚSCULAS).
- Texto com várias linhas: CAMPO: <<< na primeira linha, o texto nas linhas seguintes e >>> sozinho numa linha para fechar.
- Não use HTML nem Markdown dentro dos valores.
- CAMPAIGN_KEY é único por campanha. AD_KEY é único por anúncio e nunca deve ser reaproveitado para outro anúncio.
  Padrão sugerido: MARCA-SERVIÇO-ÂNGULO-AAAA-MM e, no anúncio, a mesma chave + -A01, -B01, -C01...
- Se for corrigir um anúncio que já existe, mantenha o mesmo AD_KEY (o app cria uma nova versão).

Campos obrigatórios da campanha:
CAMPAIGN_KEY, BRAND, PERSONA, SERVICE, OBJECTIVE, TEST_HYPOTHESIS, CHANNELS, LANDING_URL
Campos opcionais da campanha:
CAMPAIGN_NAME, MARKET, TEST_VARIABLE, CTA_DESTINATION, BUDGET_USD_PER_DAY (número ou TBD), NOTES

Campos obrigatórios de cada anúncio:
AD_KEY, ANGLE, FORMAT, FUNNEL_STAGE, HOOK, PRIMARY_TEXT, HEADLINE, CTA, VISUAL_DIRECTION
Campos opcionais do anúncio:
AD_NAME, DESCRIPTION, VIDEO_SCRIPT, IMAGE_PROMPT, NOTES, CREATIVE_STATUS

Valores sugeridos (use MAIÚSCULAS_COM_UNDERLINE):
- BRAND: ${brand.name}
- PERSONA: ${persona}
- OBJECTIVE: QUALIFIED_LEADS, AWARENESS, TRAFFIC, MESSAGES, SALES
- CHANNELS (separados por vírgula): META_PAID, FACEBOOK_ORGANIC, INSTAGRAM_ORGANIC, GOOGLE_ADS, TIKTOK, YOUTUBE, NEXTDOOR, MARKETPLACE
- FORMAT: VIDEO_9_16, VIDEO_1_1, VIDEO_16_9, IMAGE_1_1, IMAGE_4_5, IMAGE_9_16, CAROUSEL
- FUNNEL_STAGE: AWARENESS, CONSIDERATION, CONVERSION
- CTA: REQUEST_ESTIMATE, LEARN_MORE, CALL_NOW, SEND_MESSAGE, BOOK_NOW, SIGN_UP, GET_QUOTE
- ANGLE: a mensagem que está sendo testada, ex.: INSTALLATION_QUALITY, ESTIMATE_TRANSPARENCY, RELIABILITY_SUPPORT, PRICE, CONVENIENCE
- LANDING_URL: a página de destino real (https://...). Se não souber, use {{LANDING_URL}} e o dono troca no app.

Boas práticas de teste:
- Num mesmo teste, mude só uma coisa (normalmente o ÂNGULO). Mantenha serviço, público, destino e formato parecidos.
- Escreva TEST_HYPOTHESIS como uma frase que possa ser confirmada ou não pelos resultados.
- Escreva os textos dos anúncios no idioma do público da marca.

Regras de conteúdo para esta marca:
- Não invente preços, descontos, garantias, licenças, certificações, prazos, avaliações ou depoimentos.
- Não use promessas absolutas ("100%", "garantido") sem que o dono confirme.
- Nunca use estes termos (proibidos para "${brand.name}"):
${forbidden}

============================================================
EXEMPLO DO FORMATO (substitua pelo conteúdo real)
============================================================
${example}
${
  brand.persona
    ? `
============================================================
APÊNDICE — PERSONA "${brand.persona.name}" (use para tom, dores e argumentos)
============================================================
${brand.persona.content}
`
    : `
(Esta marca ainda não tem persona cadastrada no app. Cadastre em Marcas para ela vir junto neste modelo.)
`
}`;
}

/** Removes a Markdown code fence around the AI answer (```txt ... ```), a very common way AIs reply. */
export function stripCodeFence(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const first = lines.findIndex((l) => l.trim() !== "");
  if (first < 0 || !/^```[\w-]*$/.test(lines[first].trim())) return text;
  let last = lines.length - 1;
  while (last > first && lines[last].trim() === "") last--;
  if (lines[last].trim() !== "```") return text;
  return lines.slice(first + 1, last).join("\n");
}
