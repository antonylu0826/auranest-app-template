# AuraNest Calendar V2 — 系統設計計畫

> **版本**：V2 Standalone
> **規劃者**：claude-sonnet-4-6
> **參考**：V0 `dev_docs/calendar-system-plan.md`、V1 `dev_docs/005-phase-c-plan.md`

---

## 版本定位

| | V0 | V1 | **V2（此 app）** |
|---|---|---|---|
| 架構 | 7 apps 各自獨立 DB | Turborepo monorepo，multi-schema | **單一獨立 app，自己的 DB** |
| 跨 app 整合 | HTTP Webhook（HMAC） | BullMQ event queue | **無**（standalone） |
| 即時同步 | Socket.io 單機 | Redis adapter | 暫不需要（Phase C 以後再評估）|
| 使用者體系 | UserRef pattern 從 core 同步 | shared.user_refs | **本 app 自建 User 表（template 已有）** |

V2 去除跨 app 整合的複雜性，專注做一個功能完整的獨立行事曆 app。RRULE 展開、scope-aware 編輯、FullCalendar UI 等核心邏輯直接移植自 V0（已在生產環境驗證）。

---

## 技術棧

| 層 | 技術 |
|---|---|
| Backend | NestJS 11 · Prisma 6 · PostgreSQL · TypeScript 5.7 · pnpm 11 |
| Frontend | Next.js 16 · Tailwind CSS v4 · shadcn/ui · TanStack Query |
| 行事曆 UI | **FullCalendar React**（`@fullcalendar/react` + dayGrid / timeGrid / list / interaction） |
| 週期規則 | **rrule**（npm）+ **date-fns-tz**（時區，比 luxon 輕量）|
| iCal | **ical-generator**（後端匯出 RFC 5545）|
| Auth | 沿用 template：local JWT（HS256）或 OIDC（JWKS） |
| Ports | Backend `:3020` · Frontend `:3021` |

---

## 功能範圍

### In Scope（V2）

| # | 功能 | 對應 Phase |
|---|---|---|
| 1 | 個人行事曆 CRUD（建立、顏色、顯示/隱藏、刪除） | A |
| 2 | 事件 CRUD（標題、時間、全天、地點、說明、顏色） | A |
| 3 | FullCalendar 月 / 週 / 日 / 清單四視圖 | A |
| 4 | Sidebar 行事曆列表 + 顯示/隱藏切換 | A |
| 5 | 拖曳移動事件、調整時間（FullCalendar editable） | A |
| 6 | 週期性事件（RRULE daily/weekly/monthly/yearly） | B |
| 7 | 週期事件 scope-aware 編輯/刪除（THIS / FUTURE / ALL） | B |
| 8 | RruleBuilder UI | B |
| 9 | 行事曆分享（CalendarMember OWNER/EDITOR/VIEWER） | C |
| 10 | 事件邀請 + RSVP（PENDING/ACCEPTED/TENTATIVE/DECLINED） | C |
| 11 | Free/Busy 查詢（建事件時顯示衝突） | C |
| 12 | 邀請收件箱 | C |

### Out of Scope（V2 不做）

- 跨 app 整合（請假、班表、專案）— V2 是 standalone
- BullMQ / Redis — 架構不需要
- Socket.io 即時推播 — 暫不實作，用 TanStack Query refetch 替代
- 提醒（Reminder）推播 — Phase D 才評估
- iCal 訂閱 token — Phase D 才評估

---

## 資料模型

### 現有 Schema（template 已建立）

```prisma
model User { ... }          // 認證用戶
model Calendar { ... }      // 行事曆
model Event { ... }         // 事件
model EventAttendee { ... } // 出席者 RSVP

enum CalendarColor { BLUE GREEN RED YELLOW PURPLE PINK TEAL GRAY }
enum AttendeeStatus { PENDING ACCEPTED DECLINED TENTATIVE }
```

### Phase A 新增（Schema 擴充）

```prisma
/// Calendar ownership type.
enum CalendarType {
  PERSONAL  // private, owned by one user
  SHARED    // explicitly shared with selected members
}

/// Role of a user within a shared calendar.
enum CalendarMemberRole {
  OWNER   // can delete the calendar and manage members
  EDITOR  // can create/edit/delete events
  VIEWER  // read-only access
}

/// Event confirmation status.
enum EventStatus {
  CONFIRMED
  TENTATIVE
  CANCELLED
}

/// Event visibility setting.
enum EventPrivacy {
  DEFAULT  // inherits calendar default
  PUBLIC   // visible to anyone with calendar access
  PRIVATE  // title hidden from non-attendees
}

/// Who the calendar belongs to is controlled by Calendar.ownerId (existing).
/// Add CalendarType to Calendar model.
```

### Phase B 新增（週期事件欄位）

Event model 補充欄位：
- `timezone String` — IANA tz（必填，e.g. `Asia/Taipei`）
- `recurringEventId String?` — 指向主事件（override/cancellation 用）
- `originalStartAt DateTime?` — 對應的原始 occurrence 起始時間（UTC）
- `isCancelled Boolean @default(false)` — 標記此 row 為單次取消

### Phase C 新增（行事曆成員）

```prisma
/// A user's membership in a shared calendar, with role and display preferences.
model CalendarMember {
  id         String            @id @default(cuid())
  calendarId String            @map("calendar_id")
  calendar   Calendar          @relation(fields: [calendarId], references: [id], onDelete: Cascade)
  userId     String            @map("user_id")
  user       User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  /// Access level for this member.
  role       CalendarMemberRole @default(VIEWER)
  /// Per-member color override; null = use calendar default color.
  color      CalendarColor?
  /// Whether this calendar is visible on the member's grid.
  isVisible  Boolean           @default(true) @map("is_visible")
  addedAt    DateTime          @default(now()) @map("added_at")

  @@unique([calendarId, userId])
  @@map("calendar_members")
}
```

---

## API 端點規劃

### Phase A — 基礎 CRUD

```
# Calendars
GET    /calendars                         # 我的所有行事曆
POST   /calendars                         # 建立行事曆
GET    /calendars/:id                     # 取得單一行事曆
PATCH  /calendars/:id                     # 更新行事曆（名稱/顏色/可見性）
DELETE /calendars/:id                     # 刪除行事曆（非預設才可刪）

# Events
GET    /events?start=&end=&calendarIds=   # 查詢時間範圍內的事件
POST   /events                            # 建立事件
GET    /events/:id                        # 取得單一事件
PATCH  /events/:id                        # 更新事件
DELETE /events/:id                        # 刪除事件
```

### Phase B 補充（週期）

```
PATCH  /events/:id?scope=THIS_ONLY|THIS_AND_FOLLOWING|ALL
DELETE /events/:id?scope=THIS_ONLY|THIS_AND_FOLLOWING|ALL
```

`:id` 接受 master event id 或 occurrence id（格式：`<masterId>__<ISO8601>`）

### Phase C 補充（分享 + RSVP）

```
# Calendar members
POST   /calendars/:id/members             # 邀請成員
PATCH  /calendars/:id/members/:userId     # 更新成員角色
DELETE /calendars/:id/members/:userId     # 移除成員

# Attendees & RSVP
GET    /events/:id/attendees              # 出席者列表
POST   /events/:id/rsvp                  # 回覆邀請（我的 RSVP）
GET    /events/my-invites                 # 我的待回覆邀請
GET    /freebusy?userIds=&start=&end=     # 忙碌時段查詢
```

---

## 週期事件策略（Phase B）

移植自 V0 已驗證的設計，針對 V2 微調：

### 儲存方式

- **Master event**：`rrule` 欄位存 RFC 5545 RRULE 字串（e.g. `FREQ=WEEKLY;BYDAY=MO,WE,FR`）
- **Override**：建一個新 Event row，`recurringEventId = masterId`、`originalStartAt = 原始 occurrence 時間`
- **Cancellation**：同 override 但 `isCancelled = true`

### Occurrence ID

格式：`<masterId>__<UTC ISO8601>`，例如 `cm_abc123__2026-06-08T01:00:00.000Z`

前端傳 occurrence id 時，後端 decode 出 masterId + originalStartAt 再處理。

### Scope 語意

| Scope | 行為 |
|---|---|
| `THIS_ONLY` | 建 override/cancellation row；master 不動 |
| `THIS_AND_FOLLOWING` | 原 master 加 `UNTIL = originalStartAt - 1ms`；建新 master 繼承 rrule |
| `ALL` | 直接更新 master；既有 override 保留 |

### RRULE 展開

後端 `ExpansionService`：
1. 撈 master events（rrule IS NOT NULL）
2. 撈 overrides / cancellations（`recurringEventId IN [masterIds]`）
3. 用 `rrule` npm 套件展開每個 master 在查詢範圍內的 occurrences
4. 替換 overrides、移除 cancellations
5. 合併非週期事件，依 startAt 排序回傳

時區處理：使用 `date-fns-tz` 在 event.timezone 正確展開（處理 DST 邊界）

---

## 前端 UI 結構

```
┌───────────────────┬──────────────────────────────────────────┐
│  Left Sidebar     │  FullCalendar 主視圖                       │
│                   │                                            │
│  ▾ 我的行事曆     │  ◀  2026年6月  ▶    [月][週][日][清單]    │
│    ● 個人          │                                            │
│    ● 工作          │  一  二  三  四  五  六  日                 │
│    ● 家庭          │  ...                                       │
│                   │  [事件 chip]                                │
│  ▾ 共享行事曆     │                                            │
│    ○ 工程團隊     │  ────── 點擊事件 ─────────────────────── │
│                   │  EventDetailPopover（非 modal 浮動卡片）   │
│  [+ 建立行事曆]   │    標題 / 時間 / 地點 / 出席者             │
│                   │    [編輯] [刪除] [RSVP]                    │
└───────────────────┴──────────────────────────────────────────┘
```

### 頁面結構

```
frontend/src/app/(main)/dashboard/
  calendar/
    page.tsx                    # 主行事曆視圖（FullCalendar）
    _components/
      calendar-view.tsx         # FullCalendar 包裝
      calendar-toolbar.tsx      # 今天 / 上下 / 視圖切換 / 新增按鈕
      calendar-sidebar.tsx      # 行事曆列表 + 顏色 + 顯示切換
      event-detail-popover.tsx  # 點擊事件浮現的詳情卡片
      event-form-modal.tsx      # 建立/編輯事件 Dialog
      rrule-builder.tsx         # 週期設定 UI（Phase B）
      recurrence-scope-dialog.tsx # 刪/改週期事件的 scope 選擇（Phase B）
  events/
    page.tsx                    # 事件列表管理頁（TanStack Table）
    _components/
      create-event-dialog.tsx
      edit-event-dialog.tsx
      delete-event-dialog.tsx
  calendar/inbox/
    page.tsx                    # 待回覆邀請（Phase C）
```

---

## 分期計畫

### Phase A — 基礎 CRUD + FullCalendar UI

**目標**：月曆可以用，基本事件建立/編輯/刪除

Backend：
- 擴充 Schema（加 `CalendarType`、`EventStatus`、`EventPrivacy` enum）
- `CalendarsModule`：CRUD + 使用者首次登入自動建立預設個人行事曆
- `EventsModule`：CRUD（非週期）；`GET /events?start=&end=&calendarIds=` 回時間範圍內事件
- 驗證：只有行事曆 owner 才能刪除；只有 member（EDITOR 以上）才能建/改事件

Frontend：
- 安裝 `@fullcalendar/react` 及相關 plugins、`@fullcalendar/interaction`
- `CalendarView` 包裝（月/週/日/清單四視圖）
- `CalendarSidebar`（行事曆列表、顏色圓點、checkbox 切顯示/隱藏）
- `EventDetailPopover`（點擊事件後浮現，非 modal）
- `EventFormModal`（建立/編輯，RHF + Zod）
- 拖曳移動/調整時間（`editable=true`，`eventDrop` / `eventResize` 觸發 PATCH）
- Sidebar FullCalendar 小月曆（mini calendar，點選日期跳轉）

驗收：
- 建立一個「個人」行事曆 + 三個事件 → 月曆正確顯示
- 拖曳移動事件 → DB 時間更新
- 勾掉行事曆 → 事件消失

### Phase B — 週期事件

**目標**：可建立週期事件；編輯/刪除三種 scope 走通

Backend：
- Schema 補 `timezone`、`recurringEventId`、`originalStartAt`、`isCancelled` 欄位
- `ExpansionService`（移植 V0 `recurrence.util.ts`，改用 `date-fns-tz`）
- `GET /events` 整合 expansion；occurrence id 格式 `<masterId>__<ISO>`
- `PATCH/DELETE` scope-aware 邏輯

Frontend：
- `RruleBuilder` UI（頻率 / 間隔 / 星期幾 / 結束條件 / 預覽下 5 次）
- `RecurrenceScopeDialog`（刪/改時詢問：僅此次 / 此後所有 / 全部）
- EventFormModal 加週期設定 section

驗收：
- 建「每週一三五 10:00」→ 月曆展開正確
- 修改「僅此次」→ 只有該次變動，其他不變
- 刪除「此後所有」→ 指定日後全消

### Phase C — 行事曆分享 & 出席者 RSVP

**目標**：可分享行事曆；邀請出席者；收件箱回覆邀請

Backend：
- Schema 加 `CalendarMember`
- 成員管理 API
- `EventAttendee` 補完（建事件時可指定 attendees）
- `GET /events/my-invites`
- `GET /freebusy`

Frontend：
- `EventFormModal` 加出席者搜尋選擇（從系統 User 列表）
- `EventDetailPopover` 加 RSVP 按鈕 + 出席者列表
- `/dashboard/calendar/inbox` 頁面
- 建事件時若選了 attendees 且有時段衝突 → 顯示警告

### Phase D — 進階（Optional）

- iCal 匯出（`ical-generator`）— `GET /calendars/:id/export.ics`
- iCal 匯入 — `POST /calendars/:id/import.ics`
- 行事曆訂閱 token（公開 iCal URL）
- 事件提醒（cron job + email / in-app）

---

## 關鍵技術決策

| 決策 | 說明 |
|---|---|
| **RRULE 後端展開** | 客戶端不需要處理複雜時區計算；V0 已驗證，效能足夠（1 年範圍 < 100ms）|
| **Occurrence ID 格式** | `<masterId>__<ISO8601UTC>`；前端辨識 override 用；`__` 作分隔避免 id 碰撞 |
| **時區庫** | `date-fns-tz`（不用 luxon）— 更輕量，Next.js 友好 |
| **FullCalendar eventSourceFunc** | 每次 range 變動重打 API（不在前端快取 occurrence）|
| **Sidebar 可見性** | localStorage + `PATCH /calendars/:id`（isVisible）debounce 同步 |
| **不做 Socket.io** | TanStack Query `refetchInterval` + 手動 invalidate 取代；V2 standalone 不需要複雜 WS |
| **`CalendarColor` enum** | 預定義 8 色（V2 簡化版，V0 用 hex string）|

---

## 依賴套件

### Backend 新增

```json
{
  "rrule": "^2.8.x",
  "date-fns-tz": "^3.x",
  "ical-generator": "^8.x"
}
```

### Frontend 新增

```json
{
  "@fullcalendar/react": "^6.x",
  "@fullcalendar/core": "^6.x",
  "@fullcalendar/daygrid": "^6.x",
  "@fullcalendar/timegrid": "^6.x",
  "@fullcalendar/list": "^6.x",
  "@fullcalendar/interaction": "^6.x",
  "rrule": "^2.8.x"
}
```

---

## 驗收標準

| 項目 | 驗收條件 |
|---|---|
| 個人行事曆 | 首次登入自動建立預設行事曆；CRUD 正常 |
| FullCalendar 視圖 | 月/週/日/清單四視圖切換流暢；事件正確顯示 |
| 拖曳 | 移動事件 + 調整時間後 DB 正確更新；失敗自動 revert |
| 週期事件 | 每週事件展開正確；DST 切換週不出錯 |
| Scope 編輯 | 三種 scope 行為符合預期；UI 不讓使用者誤操作 |
| 行事曆分享 | 受邀成員可看到 / 編輯（依角色）該行事曆的事件 |
| RSVP | 出席者可回覆；狀態正確反映在事件詳情 |
| 型別安全 | `pnpm typecheck` 前後端皆通過 |
