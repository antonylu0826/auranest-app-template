# auranest-app-template — Claude Development Guide

## 這個 repo 是什麼

AuraNest **V2 架構**的 app 範本。每個業務 app 從這個 template fork 出去，完全獨立部署，不依賴其他 app。

### 版本沿革

| 版本 | 架構 | 位置 |
|------|------|------|
| **V0** | 單體式，自建 auth | `AuraNest/v0/`（本機，gitignored） |
| **V1** | Turborepo monorepo，8 個 NestJS backend 共用 `business_db`，shared packages（`@auranest/auth`、`@auranest/ui` 等） | `AuraNest` repo，tag `v1-snapshot`；`AuraNest/v1/`（本機，gitignored） |
| **V2（此 template）** | 各 app 獨立 repo，各自獨立 DB，auth 由 `AUTH_MODE` env 切換 | 每個 app fork 此 repo |

V1 source 可在 `AuraNest/v1/apps/` 查閱實作細節。V0 可在 `AuraNest/v0/` 查閱。

---

## Project Layout

```
backend/                    NestJS 11 + Prisma 6
  src/
    auth/
      strategies/
        local.strategy.ts   AUTH_MODE=local：HS256 JWT
        oidc.strategy.ts    AUTH_MODE=oidc：JWKS 驗 token
      guards/jwt.guard.ts
      auth.module.ts        根據 AUTH_MODE 動態掛 strategy + controller
      auth.controller.ts    只在 local 模式 register（login / register endpoints）
    users/                  本地 user 表（local 模式使用）
    notes/                  Sample resource — fork 後替換成業務模組
    prisma/                 PrismaService（Global）
    common/filters/         GlobalExceptionFilter（統一 error shape）
    health/                 GET /health（Terminus）
  prisma/schema.prisma      User + Note model

frontend/                   Next.js 16 + Tailwind v4 + shadcn/ui
  src/
    app/(main)/
      auth/login/           local：RHF 表單；oidc：SSO 按鈕
      auth/callback/        OIDC PKCE callback
      dashboard/notes/      Sample resource 頁面（TanStack Query + Dialog CRUD）
      dashboard/layout.tsx  Sidebar + Header layout
    components/ui/          shadcn/ui 元件（來自 next-shadcn-admin-dashboard）
    lib/auth.ts             token 管理、loginLocal()、redirectToOidc()
    lib/api.ts              apiFetch()（自動帶 Bearer token）+ notesApi
    hooks/use-current-user  從 JWT decode 當前使用者
    navigation/sidebar/     sidebar-items.ts — 加業務頁面改這裡
    providers/              QueryProvider（TanStack Query）

docker-compose.yml          db + backend + frontend，完全自包含
pnpm-workspace.yaml         pnpm 11 allowBuilds 設定（biome）
frontend/pnpm-workspace.yaml  pnpm 11 allowBuilds（biome + sharp + msw）
```

---

## Tech Stack

| 層 | 技術 |
|---|---|
| Backend | NestJS 11 · Prisma 6 · TypeScript 5.7 · pnpm 11 |
| Frontend | Next.js 16 · Tailwind CSS v4 · shadcn/ui · TanStack Query · React Hook Form · Zod · Zustand |
| Auth | Passport JWT（local: HS256 / oidc: RS256 JWKS） |
| Lint | Biome（root 1.9.x，frontend 2.x） |
| Dev | concurrently（root dev 腳本） |

---

## Auth 模式

`.env` 裡切換，不動程式碼：

```env
# Standalone（預設，不需要 Keycloak）
AUTH_MODE=local
JWT_SECRET=...

# SSO（Keycloak 或任何 OIDC provider）
AUTH_MODE=oidc
OIDC_JWKS_URL=https://keycloak.example.com/realms/app/protocol/openid-connect/certs
OIDC_ISSUER=https://keycloak.example.com/realms/app
OIDC_AUDIENCE=account
```

`local` 模式：backend 提供 `/auth/register` `/auth/login`，frontend 顯示表單。
`oidc` 模式：backend 只驗 JWKS，不掛 AuthController；frontend 顯示 SSO 按鈕。

---

## Naming Conventions

V1 慣例延續：

- **Files:** kebab-case（`leave-request.controller.ts`）
- **Classes / types:** PascalCase（`LeaveRequestController`）
- **Functions / vars:** camelCase（`createLeaveRequest`）
- **Constants:** SCREAMING_SNAKE_CASE（`MAX_RETRY`）
- **Env vars:** SCREAMING_SNAKE_CASE（`DATABASE_URL`、`JWT_SECRET`）
- **Never hardcode `localhost`** — 全用 env var

## Prisma Conventions

V2 與 V1 的差異：**沒有 multi-schema，沒有 `@@schema()`**，每個 app 有自己的 Postgres 實例。

- Model name: PascalCase singular（`Note`）
- Table name: snake_case plural via `@@map("notes")`
- Field: camelCase → `@map("snake_case")`
- No cross-app FK（app 之間透過 event 或 API 溝通）

## Error Response Shape

與 V1 相同（`GlobalExceptionFilter` inline 在 `common/filters/`）：

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "traceId": "abc-123",
  "timestamp": "2026-06-02T10:30:00Z",
  "path": "/notes"
}
```

---

## Fork 一個新 app 的步驟

1. Fork / copy 此 repo → 重命名（e.g. `auranest-hr`）
2. 全域替換 `notes` → 業務名稱（`leave-request` 等）
3. 修改 `frontend/src/navigation/sidebar/sidebar-items.ts` 加入業務頁面
4. 修改 `frontend/src/config/app-config.ts` 改 app 名稱
5. 修改 `backend/prisma/schema.prisma` 加業務 model（移除或保留 Note）
6. 更新 `.env.example` 的 port（避免和其他 app 衝突）

---

## Quick Start

```bash
cp .env.example .env          # 填 POSTGRES_PASSWORD、JWT_SECRET

pnpm install                  # root dev tools
pnpm -C backend install
pnpm -C frontend install

docker compose up db -d
pnpm -C backend prisma:migrate
pnpm dev                      # backend :3000 + frontend :3001
```

---

## Ask vs Act

**Self-decide:** 建檔、安裝已知 deps、boilerplate CRUD、`pnpm typecheck` / `pnpm check`。

**Stop and ask:** 新增不在 spec 的外部 deps、auth 模式設計變更、docker / infra 修改、任何 push / deploy 動作。
