# 🚀 PROMPT MASTER — FASE 1 DO CRM (Replit Agent)

> Cole esse prompt INTEIRO no Replit Agent.
> Ele vai entender o contexto e executar tudo.

---

## CONTEXTO DO PROJETO

Estou construindo um CRM gerencial para o escritório Eduardo Rodrigues Advocacia (especialista em INSS, em Carpina-PE). O sistema já tem:

- Backend Node.js + TypeScript + Drizzle ORM + PostgreSQL
- Frontend React (lib/api-client-react)
- Webhook recebendo mensagens do ChatGuru (plataforma de WhatsApp)
- Tabelas atuais: `conversations` e `webhook_events`

**ARQUITETURA:** A equipe atende pelo ChatGuru. O CRM no Replit é só pra MIM (dono). Quero visão gerencial de tudo, sem que a equipe precise acessar o Replit.

**INTEGRAÇÃO COM CHATGURU:** Endpoint `https://s22.chatguru.app/api/v1` (chave já configurada). Vou puxar tags e atendentes via API.

---

## OBJETIVO DA FASE 1

Construir o MVP do dashboard gerencial com:

1. Identificação automática de origem (qual número de WhatsApp recebeu)
2. Identificação automática de campanha (pela 1ª mensagem)
3. Sincronização de tags do ChatGuru
4. Atendente responsável
5. Dashboard com filtros poderosos

---

## CONTEXTO DE NEGÓCIO IMPORTANTE

### 📞 NÚMEROS DE WHATSAPP (origens)

| Número | Função | Equipe |
|--------|--------|--------|
| (81) 91850647 | Comercial — Tráfego pago | Thiago + Tammyres |
| (81) 99304526 | Base — Clientes existentes | Letícia, Marília, Alice, Cau |

### 📣 CAMPANHAS ATIVAS (identificar pela 1ª mensagem do lead)

| Mensagem-Gatilho | Campanha |
|---|---|
| "laudo do SUS aqui em PE" | LAUDO_SUS_PE |
| "auxílio doença" | AUX_DOENCA |
| "tenho interesse e queria mais informações" | LAUDO_SUS_GERAL |
| "auxílio-acidente" | AUX_ACIDENTE |
| "passei pela perícia e negaram" | PERICIA_NEGADA |
| (qualquer outra) | INDEFINIDA |

### 🏷️ TAGS DO CHATGURU (que vamos puxar)

**ORIGEM:** TRÁFEGO PAGO / PARCEIRO / DIGITAL / ORGÂNICO / OUTRO MEIO
**SETOR:** COMERCIAL TRÁFEGO / ATENDIMENTO
**STATUS:** LEAD NOVO / LEAD QUALIFICADO / FOLLOW UP / CONTRATO ASSINADO / CLIENTE ATIVO / CLIENTE PROCEDENTE / LEAD DESCARTADO
**CASO:** SALÁRIO MATERNIDADE / TRABALHISTA / AUX ACIDENTE / BPC IDOSO / PENSÃO POR MORTE / AUX DOENÇA / BPC DEFICIENTE / APOSENTADORIA
**MOTIVO DE DESCARTE:** (DESCARTADO) MOTIVO: JÁ TEM ADVOGADO / ACHOU CARO / SUMIU / NÃO TEM DIREITO / FOI COM OUTRO ESCRITÓRIO / DESISTIU / NÚMERO ERRADO / OUTRO

### 👥 ATENDENTES (cadastrar no banco)

**Comercial Tráfego:**
- Thiago Tavares
- Tammyres

**Atendimento (Base):**
- Letícia
- Marília
- Alice
- Cau

---

## TAREFAS A EXECUTAR

### 1️⃣ ATUALIZAR SCHEMA DO BANCO (lib/db/src/schema/)

#### 1.1 — Criar tabela `agents.ts`
```typescript
// Atendentes do escritório
export const agentsTable = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"), // pode ser null
  team: text("team").notNull(), // "COMERCIAL_TRAFEGO" ou "ATENDIMENTO"
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

#### 1.2 — Criar tabela `whatsapp_numbers.ts`
```typescript
// Números de WhatsApp do escritório (origens)
export const whatsappNumbersTable = pgTable("whatsapp_numbers", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(), // ex: "5581918506470"
  label: text("label").notNull(), // "Comercial" ou "Base"
  team: text("team").notNull(), // "COMERCIAL_TRAFEGO" ou "ATENDIMENTO"
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

#### 1.3 — Criar tabela `tags.ts`
```typescript
// Tags sincronizadas do ChatGuru
export const tagsTable = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  category: text("category").notNull(), // "ORIGEM", "SETOR", "STATUS", "CASO", "MOTIVO_DESCARTE"
  chatguruTagId: text("chatguru_tag_id"), // ID da tag no ChatGuru, se existir
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relacionamento many-to-many: conversations ↔ tags
export const conversationTagsTable = pgTable("conversation_tags", {
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id),
  tagId: integer("tag_id").notNull().references(() => tagsTable.id),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.conversationId, table.tagId] }),
}));
```

#### 1.4 — Atualizar tabela `conversations.ts`
Adicionar os seguintes campos (mantendo os existentes):
```typescript
- whatsappNumberId: integer("whatsapp_number_id").references(() => whatsappNumbersTable.id), // qual número recebeu
- agentId: integer("agent_id").references(() => agentsTable.id), // atendente responsável
- campaign: text("campaign"), // LAUDO_SUS_PE / AUX_DOENCA / etc / INDEFINIDA
- firstMessage: text("first_message"), // primeira mensagem que o lead enviou (pra identificar campanha)
- discardReason: text("discard_reason"), // motivo se foi descartado
```

**MANTER** o campo `assigned_agent` (texto) por enquanto, pra não quebrar o que já tem.

#### 1.5 — Atualizar `lib/db/src/schema/index.ts`
Exportar todos os novos schemas.

---

### 2️⃣ CRIAR LÓGICA DE IDENTIFICAÇÃO DE CAMPANHA

Criar função `identifyCampaign(firstMessage: string): string` que:

```typescript
function identifyCampaign(firstMessage: string): string {
  const msg = firstMessage.toLowerCase();
  
  if (msg.includes("laudo do sus") && msg.includes("pe")) return "LAUDO_SUS_PE";
  if (msg.includes("auxílio doença") || msg.includes("auxilio doenca")) return "AUX_DOENCA";
  if (msg.includes("auxílio-acidente") || msg.includes("auxilio-acidente")) return "AUX_ACIDENTE";
  if (msg.includes("passei pela perícia") || msg.includes("passei pela pericia")) return "PERICIA_NEGADA";
  if (msg.includes("tenho interesse") && msg.includes("mais informações")) return "LAUDO_SUS_GERAL";
  
  return "INDEFINIDA";
}
```

Quando o webhook receber um lead NOVO (sem registro anterior), aplicar essa função na primeira mensagem e salvar em `conversations.campaign`.

---

### 3️⃣ ATUALIZAR LÓGICA DO WEBHOOK

Quando uma mensagem chega via webhook do ChatGuru:

1. Identificar o número de WhatsApp que recebeu (usar a tabela `whatsapp_numbers`)
2. Verificar se já existe conversa com esse `chat_number`
3. Se NÃO existe (lead novo):
   - Criar conversation com `whatsappNumberId`, `firstMessage`, `campaign` (auto-identificada)
4. Se já existe:
   - Atualizar `lastMessage` e `lastMessageAt`
5. Salvar evento no `webhook_events` (mantém o que já faz)

---

### 4️⃣ CRIAR INTEGRAÇÃO COM API DO CHATGURU

Criar arquivo `lib/db/src/services/chatguru.ts` com funções para:

- `fetchTags()` — busca todas as tags do ChatGuru
- `fetchConversationTags(chatNumber)` — busca tags aplicadas em uma conversa específica
- `fetchAgents()` — busca atendentes do ChatGuru
- `syncAllTags()` — sincroniza tags do ChatGuru com a tabela `tags` local

**Endpoint base:** `https://s22.chatguru.app/api/v1`
**Auth:** usar a chave da API (vou colocar como variável de ambiente `CHATGURU_API_KEY`)

Criar um **job/cron** que roda a cada 5 minutos sincronizando tags das conversas ativas.

---

### 5️⃣ CRIAR ENDPOINTS DA API

```
GET    /api/agents                    → lista atendentes
POST   /api/agents                    → cria atendente
PATCH  /api/agents/:id                → atualiza
DELETE /api/agents/:id                → remove

GET    /api/whatsapp-numbers          → lista números
POST   /api/whatsapp-numbers          → cria
PATCH  /api/whatsapp-numbers/:id      → atualiza

GET    /api/tags                      → lista todas as tags
POST   /api/tags/sync                 → força sync com ChatGuru

GET    /api/conversations             → lista leads (com filtros via query params: campaign, status, agentId, whatsappNumberId, dateFrom, dateTo, tag)
GET    /api/conversations/:id         → detalhes de um lead
PATCH  /api/conversations/:id         → atualiza (mudar status, agente, etc.)
PATCH  /api/conversations/:id/tags    → aplica/remove tags

GET    /api/dashboard/stats           → métricas gerais (totais por status, por campanha, etc.)
GET    /api/dashboard/conversion      → taxa de conversão por campanha e por atendente
```

---

### 6️⃣ ATUALIZAR FRONTEND (lib/api-client-react)

#### 6.1 — Menu lateral (adicionar/atualizar páginas):
- 🏠 Dashboard (já tem, vamos turbinar)
- 💬 Conversas (já tem, vamos turbinar)
- 👥 **Equipe** (NOVA) — gerenciar atendentes
- 📞 **Números** (NOVA) — gerenciar números de WhatsApp
- 🏷️ **Tags** (NOVA) — visualizar tags sincronizadas

#### 6.2 — Dashboard (turbinar)
Adicionar:
- **Cards no topo:** total hoje / abertos / qualificados / contratos assinados / clientes ativos / procedentes
- **Filtros:** período (hoje/7d/30d/personalizado), número (Comercial/Base), campanha, status, atendente
- **Gráfico de funil:** lead novo → qualificado → contrato → ativo → procedente
- **Gráfico de pizza:** distribuição por campanha
- **Gráfico de pizza:** motivos de descarte
- **Lista de leads recentes** (com filtros aplicados)

#### 6.3 — Página Equipe
- Tabela com todos os atendentes
- Botão "Adicionar Atendente"
- Editar / Ativar / Desativar
- Mostrar contador: "X leads atendidos / Y fechados / taxa Z%"
- Filtrar por equipe (Comercial / Atendimento)

#### 6.4 — Página Números
- Cards dos 2 números (Comercial / Base) com status
- Total de leads recebidos por cada um
- Adicionar/editar números

#### 6.5 — Página Tags
- Listar tags agrupadas por categoria
- Botão "Sincronizar com ChatGuru"
- Mostrar quantas conversas têm cada tag

#### 6.6 — Detalhes do Lead (página individual)
- Dados do lead (nome, telefone, número que recebeu, campanha, primeira mensagem)
- Tags aplicadas (com possibilidade de adicionar/remover)
- Atendente responsável (com possibilidade de mudar)
- Status atual (com botão pra mudar)
- Histórico de mensagens (se disponível)
- Anotações livres
- Linha do tempo (quando criou, quando mudou de status, etc.)

---

### 7️⃣ SEED DO BANCO

Criar script `scripts/seed.ts` que insere os dados iniciais:

```typescript
// Números de WhatsApp
- { number: "5581918506470", label: "Comercial", team: "COMERCIAL_TRAFEGO" }
- { number: "5581993045260", label: "Base", team: "ATENDIMENTO" }

// Atendentes
- { name: "Thiago Tavares", team: "COMERCIAL_TRAFEGO", active: true }
- { name: "Tammyres", team: "COMERCIAL_TRAFEGO", active: true }
- { name: "Letícia", team: "ATENDIMENTO", active: true }
- { name: "Marília", team: "ATENDIMENTO", active: true }
- { name: "Alice", team: "ATENDIMENTO", active: true }
- { name: "Cau", team: "ATENDIMENTO", active: true }

// Tags (categorias e nomes)
ORIGEM: TRÁFEGO PAGO, PARCEIRO, DIGITAL, ORGÂNICO, OUTRO MEIO
SETOR: COMERCIAL TRÁFEGO, ATENDIMENTO
STATUS: LEAD NOVO, LEAD QUALIFICADO, FOLLOW UP, CONTRATO ASSINADO, CLIENTE ATIVO, CLIENTE PROCEDENTE, LEAD DESCARTADO
CASO: SALÁRIO MATERNIDADE, TRABALHISTA, AUX ACIDENTE, BPC IDOSO, PENSÃO POR MORTE, AUX DOENÇA, BPC DEFICIENTE, APOSENTADORIA
MOTIVO_DESCARTE: (DESCARTADO) MOTIVO: JÁ TEM ADVOGADO, (DESCARTADO) MOTIVO: ACHOU CARO, (DESCARTADO) MOTIVO: SUMIU, (DESCARTADO) MOTIVO: NÃO TEM DIREITO, (DESCARTADO) MOTIVO: FOI COM OUTRO ESCRITÓRIO, (DESCARTADO) MOTIVO: DESISTIU, (DESCARTADO) MOTIVO: NÚMERO ERRADO, (DESCARTADO) MOTIVO: OUTRO
```

Adicionar comando no `package.json`: `"seed": "tsx scripts/seed.ts"`.

---

### 8️⃣ MIGRAÇÃO DE DADOS EXISTENTES

Criar script de migração que:
1. Pega todas as conversations existentes
2. Tenta identificar a campanha pela primeira mensagem (se possível)
3. Tenta identificar o número de WhatsApp pela origem
4. Popula `whatsappNumberId`, `campaign`, `firstMessage` retroativamente

---

## REGRAS IMPORTANTES

1. ❌ **NÃO QUEBRAR NADA** que já está funcionando. O webhook que recebe leads tem que continuar operacional.
2. ✅ **MANTER** o campo `assigned_agent` (texto) na tabela `conversations`. Vamos migrar pra `agentId` aos poucos.
3. ✅ Usar **drizzle-kit push** pra atualizar o banco.
4. ✅ Manter o padrão de código que já existe no projeto.
5. ✅ Usar **createInsertSchema** do drizzle-zod em todos os novos schemas.
6. ✅ Toda nova rota precisa de validação Zod.
7. ✅ Frontend deve usar a estrutura React que já existe (lib/api-client-react).
8. 📱 **Responsivo:** o dashboard precisa funcionar bem no celular (vou acessar muito do iPhone).

---

## ORDEM DE EXECUÇÃO SUGERIDA

1. Schemas do banco (agents, whatsapp_numbers, tags, conversation_tags) + atualização da conversations
2. Drizzle push
3. Seed inicial
4. Lógica de identificação de campanha
5. Atualização do webhook
6. Endpoints da API
7. Integração com ChatGuru (sync de tags)
8. Frontend: páginas Equipe / Números / Tags
9. Frontend: turbinar Dashboard com filtros e gráficos
10. Frontend: página de detalhes do lead
11. Migração de dados existentes
12. Testes

---

## TESTE FINAL

Quando tudo estiver pronto, rodar um teste:

1. Mandar uma mensagem de teste pelo número Comercial → ver se aparece no dashboard com campanha identificada
2. Mandar uma mensagem pelo número Base → ver se aparece com setor ATENDIMENTO
3. Aplicar uma tag manualmente no ChatGuru → ver se sincroniza no Replit em até 5 min
4. Filtrar dashboard por campanha → ver se filtra certo
5. Mudar status de um lead pelo dashboard → ver se persiste

**Quando finalizar tudo, me avise pra eu testar.**

---

## OBSERVAÇÃO FINAL

Esse é o **MVP da Fase 1**. Depois faremos:
- Fase 2: Kanban arrastável + ficha completa do lead
- Fase 3: Métricas avançadas + ROI por campanha
- Fase 4: Pós-venda + automações + indicações (MMP)

**Vamos começar pela Fase 1. Pode executar!** 🚀
