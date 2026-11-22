# Como conectar o Facebook (Meta) ao ADS Manager

> **Importante:** hoje o app ainda **não tem o código** que fala com a Meta. A tela Integrações mostra
> "Meta Marketing API · Não conectado · Fase 2". Então são duas partes:
> **(1) você prepara as chaves na Meta** (só você consegue, leva uns 30 minutos) e
> **(2) depois a gente constrói no app** a parte que usa essas chaves.
> Enquanto isso, dá para rodar os anúncios **na mão** (veja o fim desta página).

**Nunca mande o token nem o App Secret no chat ou por e-mail.** Guarde num bloco de notas. Ele vai direto para o arquivo `.env` do servidor.

---

## Parte 1 · Organizar o Business Manager (10 min)

1. Entre em **business.facebook.com** com a sua conta pessoal do Facebook (a que é admin da página).
2. Se ainda não tem, clique **Criar conta** e crie o negócio "Cool Season LLC".
3. **Configurações do negócio** (ícone de engrenagem):
   - **Contas → Páginas:** adicione a página da Cool Season.
   - **Contas → Contas do Instagram:** conecte o Instagram da Cool Season.
   - **Contas → Contas de anúncios:** adicione a conta de anúncios (ou crie uma nova, fuso **America/New_York**, moeda **USD**).
4. Anote:
   - **ID da conta de anúncios** (número; na API vira `act_` + número)
   - **ID da página**
5. **Forma de pagamento:** Gerenciador de Anúncios → Cobrança → adicione o cartão.
6. **Trava nº 1, limite de gastos da conta:** Cobrança → **Limite de gastos da conta** → coloque o máximo que você aceita perder num mês (ex.: US$ 600). A Meta para tudo sozinha quando bater.
7. **Termos do Lead Ads:** abra `facebook.com/ads/leadgen/tos` e aceite com a página da Cool Season.

## Parte 2 · Criar o app da Meta (10 min)

8. Entre em **developers.facebook.com** → **Meus apps** → **Criar app**.
9. Tipo: **Empresa (Business)**. Nome: "Cool Season ADS Manager". Ligue ao Business "Cool Season LLC".
10. No painel do app, adicione o produto **Marketing API** (e **Webhooks**, para receber lead na hora, mais tarde).
11. **Configurações do app → Básico:** anote o **App ID** e o **App Secret**. Coloque o link da política de privacidade do site.
12. Mude o app para **Ao vivo (Live)**. Para mexer só nos seus próprios anúncios não precisa de revisão da Meta.

## Parte 3 · O token que não expira (10 min)

13. Volte ao **Business Manager → Configurações do negócio → Usuários → Usuários do sistema → Adicionar**.
    Nome: "ads-manager-bot". Função: **Admin**.
14. Clique no usuário → **Atribuir ativos**: dê acesso total à **página**, à **conta de anúncios** e ao **app**.
15. Clique **Gerar novo token** → escolha o app → validade **Nunca** → marque as permissões:

| Permissão | Para quê |
| --- | --- |
| `ads_read` | Ler campanhas e números (a primeira coisa que o app vai usar) |
| `ads_management` | Criar campanhas, conjuntos e anúncios (sempre pausados) e pausar |
| `business_management` | Ver os ativos do Business |
| `leads_retrieval` | Puxar os leads dos formulários |
| `pages_show_list`, `pages_read_engagement` | Achar a página |
| `pages_manage_metadata`, `pages_manage_ads` | Criar formulários e anúncios em nome da página |

16. **Copie o token na hora** (ele aparece uma vez só). Guarde no bloco de notas.

## Parte 4 · Onde colocar (quando o código existir)

No servidor (`/opt/campaign-lab/.env`), nunca no código nem no GitHub:

```
META_APP_ID=...
META_APP_SECRET=...
META_SYSTEM_USER_TOKEN=...
META_AD_ACCOUNT_ID=act_...
META_PAGE_ID=...
```

Me avise quando tiver os 5 valores guardados (não mande os valores, só "tenho"). Aí a gente escreve no app, em etapas, e você aprova cada uma:

1. **Só leitura** (`ads_read`): o app puxa gasto, impressões, cliques e leads de cada anúncio todo dia. Acaba a digitação manual.
2. **Leads automáticos** (`leads_retrieval`): o lead do formulário cai no CRM do app sozinho.
3. **Criar rascunho na Meta** (`ads_management`): o app cria campanha, conjuntos e anúncios **pausados** a partir do `campanha.txt`. Você confere no Gerenciador e liga.
4. **Monitor:** pausar sozinho o que estourou a regra; aumentar orçamento só com o seu OK.

Hoje o próprio app diz que "publicar ou mexer em orçamento pela API" está fora do escopo. Mudar isso é uma decisão sua.

---

## Enquanto o código não existe: rodar na mão

1. Abra o Gerenciador de Anúncios e crie campanha, conjuntos e anúncios copiando o `LEIA.md` da campanha.
2. Deixe tudo pausado, confira, ligue 2 conjuntos.
3. No app: **Publicados → Novo** → cole o **ID do anúncio** da Meta e ligue à variante (A01, B01, C01).
4. Todo dia (ou a cada 2 dias) lance os números do dia na tela do anúncio, ou exporte o CSV do Gerenciador.
5. A tela **Resultados** diz o que fazer: continuar, observar ou encerrar.
