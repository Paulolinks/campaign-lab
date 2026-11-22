# Agente de Marketing Cool Season · Guia para montar no VS Code

**Resumo:** você não precisa programar. Você faz as contas e chaves (Parte 1, uns 2 a 3 horas uma vez só) e depois cola 5 prompts no Claude Code, um por vez (Parte 3). O Claude Code escreve o código. Você testa cada fase antes de ir para a próxima.

**Objetivo do agente:** visita marcada na casa. Tudo é medido por **custo por visita marcada**, não por clique.

---

## Como funciona (visão geral)

```
 1. CRIAR        Claude escreve ideia, texto, roteiro e prompt de imagem/vídeo
      ↓          (você faz o vídeo no OpenArt e coloca na pasta)
 2. PUBLICAR     Agente sobe a campanha no Facebook/Instagram  ── sempre PAUSADA
      ↓          Você aprova no Telegram → ela liga
 3. MONITORAR    Todo dia 7h: lê custo por lead e por visita, pausa o ruim,
      ↓          sugere aumentar o bom (dentro do teto)
 4. VENDEDOR     Lead chega → resumo + falas do playbook + objeções no Telegram
                 do vendedor → cobra "marcou a visita?" até ter resposta
```

Uma coisa honesta: **o Claude não gera imagem nem vídeo.** Ele escreve os prompts. Você continua fazendo no OpenArt (como no `playbook/anuncios/openart/`) e joga o arquivo numa pasta. Isso é bom: é o único passo manual, e é onde você controla a qualidade.

---

## Parte 1 · O que VOCÊ tem que fazer (o Claude Code não consegue)

Marque cada item. Guarde cada chave num bloco de notas por enquanto, **nunca mande chave em chat nem em e-mail.**

### A. Meta (Facebook/Instagram)
1. **Business Manager:** entre em `business.facebook.com` e confira que a página da Cool Season, o Instagram e a conta de anúncios estão dentro do mesmo Business. Anote o **ID da conta de anúncios** (começa com `act_`) e o **ID da página**.
2. **Termos do Lead Ads:** aceite em `facebook.com/ads/leadgen/tos` (com a página da Cool Season).
3. **Teto de gasto da Meta (trava nº 1):** Gerenciador de Anúncios → Cobrança → **Limite de gastos da conta**. Coloque o máximo que você aceita perder num mês (ex.: US$ 600). A Meta para tudo sozinha quando bater.
4. **Criar o app:** `developers.facebook.com` → Meus apps → Criar app → tipo **Business** (Empresa) → ligue ao seu Business. Adicione os produtos **Marketing API** e **Webhooks**. Anote o **App ID** e o **App Secret**.
5. **Usuário do sistema (token que não expira):** Business Manager → Configurações do negócio → Usuários → **Usuários do sistema** → Adicionar (função Admin). Dê acesso a: a página, a conta de anúncios e o app. Clique **Gerar token**, escolha o app e marque as permissões:
   `ads_management`, `ads_read`, `business_management`, `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_ads`
   Anote o **token** (aparece uma vez só).
6. Coloque o app em modo **Live** (Ao vivo). Para usar só nos seus próprios anúncios, não precisa de revisão da Meta.

### B. Claude (API)
7. `console.anthropic.com` → crie conta → **API Keys** → crie uma chave. Anote.
8. **Teto de gasto do Claude (trava nº 2):** Settings → Limits → coloque um limite mensal (ex.: US$ 30; o uso normal deve ficar bem abaixo disso).

### C. Avisos (Telegram, grátis, 5 minutos)
9. No Telegram, fale com **@BotFather** → `/newbot` → dê o nome "Cool Season Agente". Anote o **token do bot**.
10. Mande um "oi" para o bot, você e o vendedor. O Claude Code vai descobrir os IDs de vocês na Fase 4.
> Por que Telegram e não SMS: SMS nos EUA exige registro A2P 10DLC (semanas). Dá para trocar depois.

### D. Onde roda 24h
11. **Railway** (você já usa para o Guardian). Plano Hobby, uns US$ 5/mês. Ele dá o endereço HTTPS que a Meta precisa para avisar quando chega lead. Enquanto testa, roda no seu PC mesmo.

### E. Seus números (o agente precisa saber)
12. Decida e anote: **gasto máximo por dia**, **custo máximo aceitável por visita marcada** (ex.: US$ 120), **cidades/CEPs atendidos**, **nome e Telegram do vendedor**.

---

## Parte 2 · Preparar a pasta

1. Crie uma pasta nova, por exemplo `C:\Users\paulo\agente-marketing` (separada do Video-Creator).
2. Dentro dela crie `conhecimento\` e copie para lá estes arquivos do projeto (baixe pela Biblioteca):
   - `playbook/anuncios/` inteira (D0 a D5 e a pasta `openart`)
   - `playbook/biblioteca/F1-falas-por-etapa.md`, `F2-banco-de-objecoes.md`, `F3-ajuste-por-estilo.md`
   - `playbook/perfis/C1-faixas-de-orcamento.md`, `C2-fichas-dos-12-perfis.md`
3. Abra a pasta no VS Code e abra o Claude Code nela.
4. Cole os prompts abaixo **um de cada vez**. Só passe para o próximo quando o teste da fase funcionar.

---

## Parte 3 · Os prompts

### Prompt 0 · Base do projeto (cole primeiro)

```
Vamos construir um agente de marketing para minha empresa HVAC, Cool Season (Geórgia, EUA).
Eu não sou programador: explique em português simples o que você fez e o que eu preciso fazer.
Anúncios e textos para cliente sempre em inglês. Conversa comigo em português.

Objetivo do agente: gerar VISITAS MARCADAS na casa do cliente. A métrica principal é custo por visita marcada.

Monte a base do projeto:
- Python 3.12, simples, poucos arquivos, sem frameworks pesados.
- Arquivo .env para as chaves (crie .env.example com os nomes, e coloque .env no .gitignore):
  ANTHROPIC_API_KEY, META_APP_ID, META_APP_SECRET, META_SYSTEM_USER_TOKEN, META_AD_ACCOUNT_ID,
  META_PAGE_ID, META_WEBHOOK_VERIFY_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_DONO_ID, TELEGRAM_VENDEDOR_ID
- config.yaml com meus limites: gasto_max_dia, gasto_max_campanha, custo_max_por_visita,
  cidades/CEPs atendidos, modo_aprovacao: true (no começo nada é publicado sem eu aprovar).
- Banco SQLite (agente.db) com tabelas: ideias, anuncios, campanhas, metricas_diarias, leads, eventos_log.
- Todo passo importante grava em eventos_log (o que fez, por quê, quanto custou).
- Modelo Claude: use "claude-opus-5-5" para criar anúncios e para conversar com vendedor,
  e "claude-sonnet-5-5" para o relatório diário. Deixe os nomes dos modelos no config.yaml.
- A pasta conhecimento/ tem meu playbook (regras dos anúncios em D0, públicos D1-D5, OpenArt,
  falas F1, objeções F2, estilos F3, perfis C1-C2). Leia esses arquivos agora e me diga em 5 linhas o que entendeu.
- Crie um CLAUDE.md com estas regras fixas para você mesmo seguir sempre:
  1. Nunca publicar nem ligar anúncio sem aprovação minha enquanto modo_aprovacao=true.
  2. Todo anúncio é criado na Meta com status PAUSED.
  3. Nunca passar de gasto_max_dia nem gasto_max_campanha. Na dúvida, pausa.
  4. Seguir as regras do D0: sem preço, sem "só hoje", sem promessa de economia ou saúde, sem falar de concorrente,
     sem financiamento, Guardian descrito como ele é.
  5. Nunca mostrar chaves/tokens em logs ou mensagens.
Me mostre a estrutura e como eu preencho o .env.
```

**Teste:** você preenche o `.env` e ele roda um comando que só confere se as chaves funcionam (Claude responde, Meta devolve o nome da conta de anúncios, Telegram manda "oi").

---

### Prompt 1 · Criar anúncios

```
Fase 1: criador de anúncios.

Crie o comando: python criar.py --publico D1 (ou D2..D5, ou "auto" para você escolher pelo mês/estação).
Ele deve usar o Claude com o conteúdo de conhecimento/ e gerar, para o público escolhido:
- 3 ideias de ângulo, cada uma com objetivo e por que deve gerar visita marcada
- para cada ideia: texto principal (curto, médio, história), título, descrição, botão (CTA)
- roteiro de vídeo 30-45s cena por cena + prompts para OpenArt no formato do arquivo openart/
- prompt de imagem estática (1080x1350) para o caso de anúncio sem vídeo
- formulário do Lead Ad: 3 a 4 perguntas que ajudam o vendedor (idade do sistema, problema, melhor horário),
  com nome, telefone e CEP
Considere a estação atual (inverno = aquecimento, heat pump, casa fria).

Depois de gerar, rode uma segunda checagem automática com o Claude contra as regras do D0 e reprove o que violar.
Salve tudo no banco e numa pasta saida/AAAA-MM-DD_publico/ com um arquivo LEIA.md em português
explicando cada ideia e a tradução dos textos. Crie a subpasta midia/ onde eu vou colocar o vídeo/imagem que fizer no OpenArt.
Me mande no Telegram um resumo com as 3 ideias.
```

**Teste:** rode para D1. Leia o `LEIA.md`. Se o texto não estiver bom, fale com o Claude Code: "ajuste o prompt de criação para ..." até ficar no nível que você quer.

---

### Prompt 2 · Publicar no Facebook/Instagram (com aprovação)

```
Fase 2: publicar via Meta Marketing API. Use a versão atual da Graph API (confira na documentação qual é).

Crie: python publicar.py --pasta saida/AAAA-MM-DD_publico
- Confere se existe arquivo em midia/. Se não tiver, para e me avisa.
- Sobe a imagem/vídeo para a conta de anúncios.
- Cria o formulário de Lead Ad na página (perguntas da fase 1, link da política de privacidade do config.yaml).
- Cria campanha objetivo OUTCOME_LEADS, conjunto de anúncios com orçamento diário do config (nunca acima de gasto_max_dia),
  localização = minhas cidades/CEPs, Facebook + Instagram, e um anúncio por ideia aprovada (teste A/B das ideias).
- TUDO criado com status PAUSED.
- Nome padrão: CS_{publico}_{data}_{ideia}.
- Depois me manda no Telegram: prévia (texto + link de preview do anúncio), orçamento, público,
  com dois botões: "Aprovar e ligar" / "Rejeitar".
- Só quando eu clicar Aprovar ele muda para ACTIVE. Rejeitar deixa pausado e anota o motivo.
- Antes de ligar, confere de novo: soma do gasto diário de todas as campanhas ativas + esta <= gasto_max_dia. Se passar, não liga e me avisa.
Primeiro rode tudo em modo --simular (mostra o que faria, sem chamar a Meta). Depois a gente roda de verdade.
```

**Teste:** `--simular` primeiro. Depois de verdade com orçamento baixo (US$ 10/dia). Confira no Gerenciador de Anúncios que apareceu pausado, aprove pelo Telegram e veja ligar.

---

### Prompt 3 · Monitorar todo dia (pausar e escalar)

```
Fase 3: monitor diário.

Crie python monitorar.py que roda todo dia às 7h (horário de Nova York):
- Puxa da Meta os números de ontem e dos últimos 7 dias por anúncio: gasto, impressões, cliques, leads, custo por lead.
- Junta com o banco: quantos leads de cada anúncio viraram VISITA MARCADA (vem da fase 4) e custo por visita marcada.
- Regras (todas no config.yaml para eu mudar):
  - Anúncio gastou mais que 2x o custo_max_por_visita e tem 0 visitas → PAUSAR.
  - Custo por lead mais que 2x a média dos outros depois de US$ 40 gastos → PAUSAR.
  - Não decidir nada com menos de 3 dias ou menos de US$ 30 gastos (pouco dado).
  - Custo por visita abaixo do custo_max_por_visita por 3 dias → SUGERIR aumentar 20% (no máximo 1 vez a cada 3 dias,
    sem passar de gasto_max_dia).
  - Frequência acima de 3 → sugerir criativo novo (roda a fase 1 para aquele público).
- Pausar ele pode fazer sozinho (é seguro). Aumentar orçamento ou ligar algo novo: só com meu botão no Telegram
  enquanto modo_aprovacao=true.
- Me manda no Telegram um relatório curto em português: gasto ontem, leads, visitas marcadas, custo por visita,
  o que pausou, o que sugere, e 1 frase de "o que eu faria hoje".
- Trava extra: se o gasto do dia passar de gasto_max_dia em qualquer checagem, pausa todas as campanhas e me avisa.
  Faça essa checagem a cada 2 horas.
```

**Teste:** rode na mão com dados reais depois de 3 ou 4 dias de anúncio rodando.

---

### Prompt 4 · Assistente do vendedor (quando chega o lead)

```
Fase 4: lead chega → vendedor preparado → visita marcada.

- Crie um pequeno servidor web (FastAPI) com a rota /webhook/meta que:
  - faz a verificação da Meta (hub.challenge com META_WEBHOOK_VERIFY_TOKEN) e confere a assinatura X-Hub-Signature-256 com o App Secret;
  - recebe o evento "leadgen", busca os dados do lead na API (leads_retrieval) e salva no banco.
- Crie o comando que inscreve meu app no campo leadgen da minha página.
- Assim que o lead chega (em menos de 1 minuto), manda no Telegram do vendedor:
  - nome, telefone (clicável), cidade, respostas do formulário, de qual anúncio veio
  - resumo de 3 linhas: o que essa pessoa provavelmente quer e qual perfil de C2 parece ser
  - as 3 primeiras falas para a ligação (de F1, ajustadas por F3) — o objetivo da ligação é SÓ marcar a visita, sem preço
  - as 3 objeções mais prováveis para esse anúncio/perfil (de F2) com a resposta curta
  - botões: "Liguei – visita marcada" (pede data/hora), "Liguei – não atendeu", "Não quer", "Fora da área"
- Cobrança: se em 15 minutos o vendedor não clicou nada, lembra ele. Em 1 hora, me avisa (dono).
  "Não atendeu": lembra de ligar de novo em 2h e no dia seguinte de manhã (máximo 4 tentativas).
- Visita marcada: grava no banco (é a métrica da fase 3), manda para o vendedor a mensagem de confirmação para o cliente
  (texto do D1-D5, em inglês, pronta para copiar) e lembra o vendedor 1 dia antes e 2h antes da visita.
- Depois da visita: pergunta ao vendedor "como foi?" (vendeu / proposta enviada / não vendeu + motivo) e guarda.
- Se o vendedor mandar uma pergunta em texto livre no Telegram ("cliente disse que vai pensar, o que eu falo?"),
  o Claude responde usando F1-F3 e C1-C2, curto, em português, com a frase em inglês para usar.
Teste primeiro com a ferramenta de teste de Lead Ads da Meta (Lead Ads Testing Tool).
```

**Teste:** Lead Ads Testing Tool da Meta (`developers.facebook.com/tools/lead-ads-testing`) → mande um lead falso → tem que chegar no Telegram do vendedor em menos de 1 minuto.

---

### Prompt 5 · Colocar no ar 24h (Railway)

```
Fase 5: colocar no ar.
- Prepare o projeto para o Railway: servidor do webhook sempre ligado, monitorar.py às 7h, checagem de gasto a cada 2h,
  e o bot do Telegram ouvindo os botões.
- O banco SQLite precisa ficar num volume persistente do Railway (ou troque para o Postgres do Railway, o que for mais simples).
- Me passe o passo a passo em português: criar o projeto no Railway, colocar as variáveis do .env lá,
  e colar a URL https://.../webhook/meta no app da Meta (Webhooks → Page → leadgen).
- Crie um comando /status no Telegram que me mostra: campanhas ativas, gasto de hoje, leads de hoje, visitas da semana.
- Crie um comando /parar que pausa TODAS as campanhas na hora (botão de emergência).
```

---

## Parte 4 · Travas de segurança (resumo)

| Trava | Onde | O que faz |
| --- | --- | --- |
| Limite de gastos da conta | Meta (você configura) | A Meta para tudo ao bater o valor do mês. A trava mais forte. |
| Limite mensal da API | console.anthropic.com | O Claude nunca custa mais que isso |
| Tudo nasce PAUSADO | Código (Prompt 2) | Nada gasta sem ligar |
| Aprovação no Telegram | `modo_aprovacao: true` | Você aprova ligar e aumentar orçamento |
| Teto por dia e por campanha | `config.yaml` | O agente recusa passar |
| Checagem a cada 2h | Prompt 3 | Estourou o dia, pausa tudo |
| `/parar` | Telegram | Botão de emergência |
| Checagem das regras do D0 | Prompt 1 | Bloqueia texto com preço, promessa ou "só hoje" |

**Quando tirar a aprovação:** depois de umas 4 semanas, quando as sugestões do agente baterem com o que você faria. Aí mude `modo_aprovacao` para `false` só para **pausar e escalar até 20%**. Ligar campanha nova continua passando por você.

---

## Quanto custa por mês (estimativa)

- Claude API: uns US$ 10 a 25 (poucos anúncios por semana + relatório diário + leads)
- Railway: uns US$ 5
- Telegram: grátis
- Anúncios: o que você definir no teto

## Ordem sugerida

Semana 1: Parte 1 + Prompts 0 e 1 (só criar anúncios, sem publicar nada).
Semana 2: Prompt 2 com US$ 10/dia e Prompt 4 (lead chegando no vendedor).
Semana 3: Prompt 5 (no ar 24h) e Prompt 3 (monitor), depois de ter uns dias de dados.

Se travar em algum passo, copie a mensagem de erro e cole no Claude Code com "explique em português e resolva".
