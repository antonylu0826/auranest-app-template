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
  .env                      本地開發用（Prisma + NestJS 讀這裡，與根目錄 .env 分開）
  pnpm-workspace.yaml       pnpm 11 allowBuilds（bcrypt、prisma、@nestjs/core 等）
  src/
    auth/
      strategies/
        local.strategy.ts   AUTH_MODE=local：HS256 JWT（payload: sub/email/name/role）
        oidc.strategy.ts    AUTH_MODE=oidc：JWKS 驗 token
      guards/
        jwt.guard.ts        JwtAuthGuard — 驗 Bearer token
        roles.guard.ts      RolesGuard — 依 JWT role 檢查權限層級
      decorators/
        roles.decorator.ts  @Roles(UserRole.ADMIN) 裝飾器
      auth.module.ts        根據 AUTH_MODE 動態掛 strategy + controller
      auth.controller.ts    只在 local 模式：POST /auth/register、/auth/login、GET /auth/me
    users/
      users.controller.ts   CRUD /users（全需 ADMIN）
      users.service.ts      findAll/findById/create/update/updateRole/remove
      dto/user.dto.ts       CreateUserDto、UpdateUserDto、UpdateRoleDto
    prisma/                 PrismaService（Global）
    common/filters/         GlobalExceptionFilter（統一 error shape）
    health/                 GET /health（Terminus）
  prisma/schema.prisma      User model（含 UserRole enum: ADMIN/USER）
  prisma/seed.ts            建立預設 ADMIN 帳號（讀 SEED_USER_* env vars，upsert 不重複）

frontend/                   Next.js 16 + Tailwind v4 + shadcn/ui
  messages/
    zh-TW.json              繁中翻譯（sidebar / auth / nav / users / welcome / pages / common）
    en.json                 英文翻譯
  src/
    app/(main)/
      auth/login/           local：RHF 表單；oidc：SSO 按鈕
      auth/callback/        OIDC PKCE callback
      dashboard/
        layout.tsx          Sidebar + Header（含 Breadcrumb、LocaleSwitcher、LayoutControls、ThemeSwitcher）
        page.tsx            歡迎頁（個人化問候 + 快速存取卡片）
        users/
          page.tsx          Users 管理頁（data table、搜尋、skeleton loading）
          _components/
            create-user-dialog.tsx  建立用戶（RHF + Zod）
            edit-user-dialog.tsx    編輯 name + role（RHF + Zod）
            delete-user-dialog.tsx  刪除確認（AlertDialog）
    components/
      app-breadcrumb.tsx    路徑麵包屑（自動從 pathname 產生，支援 i18n）
      locale-switcher.tsx   語言切換 dropdown（cookie 持久化）
      ui/                   shadcn/ui 元件
    config/app-config.ts    ⚠️ Fork 後修改：app 名稱、meta title/description
    i18n/
      config.ts             locale 清單（locales、defaultLocale、Locale type）
      messages.ts           靜態 import 所有翻譯檔
      provider.tsx          I18nProvider（React Context）+ useTranslations() + useLocale()
    lib/
      auth.ts               token 管理、loginLocal()、redirectToOidc()、decodeToken()
      api.ts                apiFetch()（自動帶 Bearer token）+ usersApi
    hooks/use-current-user  從 JWT decode 當前使用者（useEffect 讀 localStorage，避免 hydration mismatch）
    navigation/sidebar/
      sidebar-items.ts      ⚠️ Fork 後加業務頁面 — title 用 i18n key（對應 messages.sidebar）
    server/server-actions.ts  getPreference()、setLocale() 等 server actions
    providers/              QueryProvider（TanStack Query）
    scripts/theme-boot.tsx  Pre-hydration theme boot script（export 字串，layout 直接注入）

docker-compose.yml          db + backend + frontend，完全自包含
.env                        Docker Compose 用（POSTGRES_* / AUTH_MODE / SEED_USER_* 等）
backend/.env                本地開發用（DATABASE_URL / AUTH_MODE / SEED_USER_* 等）
pnpm-workspace.yaml         pnpm 11 allowBuilds 設定（biome）
backend/pnpm-workspace.yaml  pnpm 11 allowBuilds（bcrypt、prisma、@nestjs/core 等）
frontend/pnpm-workspace.yaml  pnpm 11 allowBuilds（biome + sharp + msw + @parcel/watcher + @swc/core）
```

---

## Tech Stack

| 層 | 技術 |
|---|---|
| Backend | NestJS 11 · Prisma 6 · TypeScript 5.7 · pnpm 11 |
| Frontend | Next.js 16 · Tailwind CSS v4 · shadcn/ui · TanStack Query · TanStack Table · React Hook Form · Zod · Zustand · next-intl（移除，改用自製 I18nProvider） |
| Auth | Passport JWT（local: HS256 / oidc: RS256 JWKS）· RBAC（UserRole enum：ADMIN / USER） |
| i18n | 自製 React Context（`src/i18n/provider.tsx`）· 翻譯檔在 `messages/`（zh-TW / en） |
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

## RBAC

JWT payload 包含 `role: UserRole`（ADMIN / USER）。

```
RolesGuard：ADMIN(100) > USER(10)
@Roles(UserRole.ADMIN) → 只有 ADMIN 可存取

Users API 全部需要 ADMIN：
  POST   /users          建立用戶
  GET    /users          列出所有用戶
  GET    /users/:id      取得單一用戶
  PATCH  /users/:id      更新 name / isActive
  PATCH  /users/:id/role 更新角色
  DELETE /users/:id      刪除用戶
```

Seed 帳號預設為 ADMIN。Frontend sidebar 的 Admin 群組僅 ADMIN 可見（`useCurrentUser()` 讀 JWT role）。

---

## i18n

自製輕量 React Context，**不需要 next-intl plugin**：

```
messages/zh-TW.json   繁中（預設）
messages/en.json      英文

src/i18n/config.ts    locales = ["zh-TW", "en"]、defaultLocale
src/i18n/messages.ts  靜態 import 兩份翻譯，export allMessages
src/i18n/provider.tsx I18nProvider + useTranslations(namespace) + useLocale()
```

`layout.tsx` 從 cookie 讀 `locale`，靜態取 messages，傳給 `<I18nProvider>`。  
切換語言由 `LocaleSwitcher` 呼叫 `setLocale()` server action 寫 cookie 後 reload。

**加新翻譯的方式（fork 後）：**
1. 在 `messages/zh-TW.json` 和 `messages/en.json` 加 key
2. 在 component 用 `const t = useTranslations("namespace")` 取用

**sidebar 選單 i18n：** `sidebar-items.ts` 的 `title`/`label` 填 translation key（對應 `messages.sidebar`），`nav-main.tsx` 自動用 `t()` 解析。

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

- Model name: PascalCase singular（`User`）
- Table name: snake_case plural via `@@map("users")`
- Field: camelCase → `@map("snake_case")`
- No cross-app FK（app 之間透過 event 或 API 溝通）
- Prisma client output: 預設路徑（`node_modules/@prisma/client`），**不使用自訂 output**

## Frontend UI 元件規範

建表單或 UI 前，**必須先查閱 `frontend/src/components/ui/`**，優先使用範本已有的 shadcn 元件，不直接用 HTML 原生控制項。

| 用途 | 使用元件 |
|------|----------|
| 日期選擇 | `DatePicker`（`components/ui/date-picker.tsx`）|
| 時間選擇 | `TimePicker`（`components/ui/time-picker.tsx`，24 小時制，HH:mm）|
| 日期範圍 | `DateRangePicker`（`components/ui/date-range-picker.tsx`）|
| 下拉選單 | `Select`（`components/ui/select.tsx`）|
| 核取方塊 | `Checkbox`（`components/ui/checkbox.tsx`）|
| 開關切換 | `Switch`（`components/ui/switch.tsx`）|
| 多行文字 | `Textarea`（`components/ui/textarea.tsx`）|

凡 `<input type="date">` 、`<select>`、`<input type="checkbox">` 等 HTML 原生控制項，都應替換為上表對應的 shadcn 元件以確保視覺一致性。

---

## Error Response Shape

與 V1 相同（`GlobalExceptionFilter` inline 在 `common/filters/`）：

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "traceId": "abc-123",
  "timestamp": "2026-06-02T10:30:00Z",
  "path": "/users"
}
```

---

## 新增一個業務模組的標準流程

每次新增 CRUD 功能（如員工管理、組織部門）都照以下順序進行。

### 1. Backend — Schema

```prisma
// backend/prisma/schema.prisma

/// Brief English description of what this enum represents.
enum MyStatus {
  ACTIVE   // optional per-value doc
  INACTIVE
}

/// English description of the model and its business purpose.
model MyModel {
  id        String    @id @default(cuid())
  /// Field-level description: business meaning, constraints, examples.
  name      String
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  @@map("my_models")
}
```

> **`///` doc comments are mandatory** — they feed into three AI-agent metadata layers (see *AI Agent Metadata* section below).

> ⚠️ **停掉 dev server** 再執行 generate / migrate（避免 Windows DLL 鎖定）

```bash
npx prisma generate
npx prisma migrate dev --name add_my_model
```

### 2. Backend — Module

依序建立：

```
backend/src/my-module/
  dto/my-model.dto.ts        # Zod schema + TypeScript type
  my-module.service.ts       # findAll / findOne / create / update / remove
  my-module.controller.ts    # @Controller + @UseGuards + ZodValidationPipe
  my-module.module.ts
```

- `findAll` 使用 `paginationQuerySchema` + `paginate()` / `toPrismaPage()` / `toPrismaOrderBy()`（來自 `common/pagination`）
- Controller 一律加 `JwtAuthGuard` + `RolesGuard`
- 在 `app.module.ts` imports 陣列加入新 module

```bash
npx tsc --noEmit   # 確認無型別錯誤
```

### 3. Frontend — API

```
frontend/src/lib/my-model-api.ts
```

- export `MyModel` interface（與 backend response 欄位對應）
- export `myModelApi.list / get / create / update / remove`
- list 函式接受 `ListQuery`，回傳 `PaginatedResult<MyModel>`

### 4. Frontend — i18n

在 `frontend/messages/zh-TW.json` 和 `en.json` 同步加入：

```json
{
  "sidebar": { "myModule": "顯示名稱" },
  "pages":   { "myModule": "顯示名稱" },
  "myModule": {
    "title": "...", "newItem": "...",
    "searchPlaceholder": "...", "noItems": "..."
    // CRUD 動作、欄位標籤、enum 對應文字…
  }
}
```

### 5. Frontend — Sidebar

`frontend/src/navigation/sidebar/sidebar-items.ts`：

```ts
{
  title: "myModule",          // 對應 messages.sidebar.myModule
  url: "/dashboard/my-module",
  icon: SomeIcon,
}
```

若新路由 segment 需要出現在麵包屑，同步更新 `app-breadcrumb.tsx` 的 `TRANSLATABLE_SEGMENTS`（對應 `messages.pages`）。

### 6. Frontend — 頁面

```
frontend/src/app/(main)/dashboard/my-module/
  page.tsx                   # 列表（TanStack Table + server-side 搜尋/排序/分頁）
  new/page.tsx               # 新增
  [id]/edit/page.tsx         # 編輯（useQuery 載入 → useEffect reset form）
  _components/
    my-model-form.tsx        # 共用表單（RHF + Zod，欄位多時用獨立頁面）
    delete-my-model-dialog.tsx
```

**欄位多（> 8 個）→ 獨立頁面；欄位少 → Dialog 即可。**

```bash
npx tsc --noEmit   # 前後端都要確認無型別錯誤再 commit
```

---

## AI Agent Metadata

Three layers expose schema knowledge to AI agents. **All descriptions must be in English** to minimise token usage.

### Layer 1 — Prisma `///` doc comments (source of truth)

Write `///` above every enum, model, and non-obvious field. Use single-line English sentences.

```prisma
/// Brief description of the enum's business purpose.
enum EmploymentStatus {
  ACTIVE      // currently employed
  RESIGNED    // voluntary separation
}

/// Description of the model and its role in the domain.
model EmployeeProfile {
  /// Company-assigned ID, e.g. "EMP-001". Must be unique.
  employeeNumber String @unique @map("employee_number")
}
```

### Layer 2 — `GET /meta/schema` (runtime)

Returns a JSON payload of all models + fields + enum values with their `///` documentation.
Requires `Authorization: Bearer <ADMIN token>`.

```json
{
  "generatedAt": "...",
  "models": [{ "name": "EmployeeProfile", "documentation": "...", "fields": [...] }],
  "enums":  [{ "name": "EmploymentStatus", "documentation": "...", "values": [...] }]
}
```

AI agents running at runtime can `GET /meta/schema` to self-orient before querying data.

### Layer 3 — `docs/data-dictionary.md` (design-time)

Auto-generated Markdown consumed by AI agents during design or code-review sessions.

```bash
pnpm -C backend schema:docs   # regenerate after any schema change
```

**Workflow rule:** After every `prisma migrate dev`, run `schema:docs` and commit the updated `docs/data-dictionary.md` together with the migration.

---

## Fork 一個新 app 的步驟

1. Fork / copy 此 repo → 重命名（e.g. `auranest-hr`）
2. 修改 `frontend/src/config/app-config.ts` — app 名稱、meta title / description
3. 修改 `frontend/src/navigation/sidebar/sidebar-items.ts` — 加業務頁面（title 用 i18n key）
4. 在 `messages/zh-TW.json` 和 `messages/en.json` 加對應翻譯（`sidebar`、`pages` namespace）
5. 修改 `backend/prisma/schema.prisma` — 加業務 model
6. 在 `backend/src/` 建立業務模組（參考 Users 模組結構）
7. 在 `frontend/src/app/(main)/dashboard/` 建立業務頁面（參考 users/ 目錄結構）
8. 更新 `.env.example` 的 port（避免和其他 app 衝突）
9. 設定 `SEED_USER_*` → 執行 `pnpm -C backend prisma:seed` 建立初始 ADMIN 帳號

---

## Quick Start

```bash
cp .env.example .env          # 填 POSTGRES_PASSWORD、JWT_SECRET、SEED_USER_*

# backend 需要自己的 .env（Prisma / NestJS 從執行目錄讀，不繼承根目錄）
cp .env backend/.env          # 再手動補 DATABASE_URL=postgresql://postgres:<密碼>@localhost:5432/app_db

pnpm install                  # root dev tools
pnpm -C backend install
pnpm -C frontend install

docker compose up db -d
pnpm -C backend prisma:migrate   # 建立 schema
pnpm -C backend prisma:seed      # 建立預設 ADMIN 帳號（SEED_USER_* 設定在 backend/.env）
pnpm dev                         # backend :3000 + frontend :3001
```

> **兩個 `.env` 的分工**
> - 根目錄 `.env` — Docker Compose 讀取（`POSTGRES_*`、`AUTH_MODE`、port 等）
> - `backend/.env` — 本地 NestJS / Prisma CLI 讀取（需包含 `DATABASE_URL`）
> - `SEED_USER_EMAIL / SEED_USER_PASSWORD / SEED_USER_NAME` 兩份都要填（seed 從 `backend/.env` 讀）

---

## Ask vs Act

**Self-decide:** 建檔、安裝已知 deps、boilerplate CRUD、`pnpm typecheck` / `pnpm check`。

**Stop and ask:** 新增不在 spec 的外部 deps、auth 模式設計變更、docker / infra 修改、任何 push / deploy 動作。
