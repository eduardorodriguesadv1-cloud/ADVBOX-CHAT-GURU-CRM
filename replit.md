# Workspace

## Overview

pnpm workspace monorepo using TypeScript. CRM dashboard for Eduardo Rodrigues Advocacia (INSS specialist, Carpina-PE).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind + shadcn/ui

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm dlx tsx artifacts/api-server/scripts/seed.ts` — seed DB with agents, numbers, tags

## Project Structure

- `lib/db` — DB schemas + Drizzle client
- `lib/api-zod` — generated Zod schemas from OpenAPI
- `lib/api-client-react` — generated React Query hooks
- `artifacts/api-server` — Express API (port via PORT env var, 8080 in dev)
- `artifacts/chatguru-monitor` — React CRM frontend

## Database Schema

- **conversations** — leads/conversations from WhatsApp (chatNumber, status, assignedAgent, agentId, whatsappNumberId, campaign, firstMessage, contextData)
- **agents** — atendentes (Thiago Tavares, Tammyres = Comercial; Letícia, Marília, Alice, Cau = Atendimento)
- **whatsapp_numbers** — números WhatsApp (Comercial 81918506470, Base 81993045260)
- **tags** — classificação de leads em 5 categorias (ORIGEM, SETOR, STATUS, CASO, MOTIVO_DESCARTE)
- **conversation_tags** — many-to-many entre conversations e tags
- **webhook_events** — log de webhooks recebidos do ChatGuru

## API Routes

- `GET/POST /api/agents` — CRUD atendentes
- `PATCH/DELETE /api/agents/:id`
- `GET /api/whatsapp-numbers` — listar números com contagem de leads
- `GET /api/tags` — listar tags agrupadas por categoria
- `POST /api/tags/sync` — sincronizar tags
- `PATCH /api/tags/conversation/:id` — aplicar/remover tags de conversa
- `GET /api/chatguru/conversations` — listar conversas com filtros
- `GET /api/chatguru/stats` — estatísticas do dashboard
- `POST /api/chatguru/webhook` — receber eventos do ChatGuru
- `POST /api/chatguru/send-message` — enviar mensagem via ChatGuru API
- `GET/POST /api/chatguru/check-status` — consultar status de número

## Frontend Pages

- `/` — Dashboard (stats, funil, conversas recentes)
- `/conversations` — Lista de conversas com filtros
- `/reengagement` — Envio em massa para leads parados
- `/team` — Gerenciar equipe (atendentes por setor)
- `/numbers` — Números de WhatsApp com contagem de leads
- `/tags` — Tags categorizadas com uso
- `/check` — Consultar status de número no ChatGuru

## External Integrations

- **ChatGuru API**: `https://app.zap.guru/api/v1` (CHATGURU_API_KEY, CHATGURU_ACCOUNT_ID, CHATGURU_PHONE_ID)
- Webhook configurado para receber eventos de conversa

## Campaign Identification

`artifacts/api-server/src/lib/campaign.ts` — identifica campanha de origem pelo conteúdo da primeira mensagem do lead.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
