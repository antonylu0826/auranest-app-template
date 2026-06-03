# AuraNest Calendar V2 — Task Breakdown

> **規劃者**：claude-sonnet-4-6
> **參考**：V0 `dev_docs/calendar-task-breakdown.md`、`001-calendar-plan.md`
> **複雜度**：S = 半天內　M = 1–2 天　L = 3 天以上

---

## 前置決策（進入 Phase A 前拍板）

| # | 決議 |
|---|---|
| D1 | RRULE 展開全部在後端；API 回展開後的 occurrence 陣列 |
| D2 | Occurrence ID 格式：`<masterId>__<UTC ISO8601>`（雙底線分隔）|
| D3 | 時區用 `date-fns-tz`（不用 luxon）；Event.timezone 存 IANA tz name |
| D4 | Override = 建新 Event row（`recurringEventId`）；Cancellation = isCancelled=true |
| D5 | `THIS_AND_FOLLOWING` = 截斷原 master（加 UNTIL）+ 建新 master |
| D6 | CalendarColor 維持 enum（8 色預定義）；Phase D 再考慮開放 hex |
| D7 | 不做 Socket.io；用 TanStack Query invalidateQueries 替代即時同步 |
| D8 | 首次登入自動建立「個人」預設行事曆（isDefault=true，不可刪）|

---

## Phase A — 基礎 CRUD + FullCalendar UI

> **目標**：月曆可以用，非週期事件 CRUD 完整，拖曳可操作

### A1：Schema 擴充與 Migration

**複雜度**：S

新增 enum 與欄位：
- `CalendarType`（PERSONAL / SHARED）加入 `Calendar` model
- `EventStatus`（CONFIRMED / TENTATIVE / CANCELLED）加入 `Event` model
- `EventPrivacy`（DEFAULT / PUBLIC / PRIVATE）加入 `Event` model
- `Event.timezone String @default("Asia/Taipei")`
- `Calendar.isDefault Boolean @default(false)`

```bash
pnpm -C backend prisma:migrate  # --name add_calendar_types
```

**DoD**：`pnpm typecheck` 通過；DB schema 更新

---

### A2：CalendarsModule（後端）

**複雜度**：M

```
backend/src/calendars/
  dto/calendar.dto.ts
  calendars.service.ts
  calendars.controller.ts
  calendars.module.ts
```

端點：
- `GET /calendars` — 列出我的行事曆（owned + shared）
- `POST /calendars` — 建立（type 預設 PERSONAL）
- `GET /calendars/:id` — 取得單一
- `PATCH /calendars/:id` — 更新名稱 / 顏色 / isVisible
- `DELETE /calendars/:id` — 刪除（isDefault=true 拒絕）

Business rules：
- `ensureDefaultCalendar(userId)`：首次查詢時 lazy 建立 `isDefault=true` 的個人行事曆
- 只有 owner 可 PATCH / DELETE

**DoD**：curl CRUD 走通；非 owner 修改回 403；首次 GET 自動建預設行事曆

---

### A3：EventsModule（後端，非週期）

**複雜度**：M

```
backend/src/events/
  dto/event.dto.ts
  events.service.ts
  events.controller.ts
  events.module.ts
```

端點：
- `GET /events?start=&end=&calendarIds=` — 查詢範圍內事件（初期只查 `rrule IS NULL`）
- `POST /events` — 建立（body: calendarId, title, startAt, endAt, timezone, isAllDay, ...）
- `GET /events/:id` — 取得單一
- `PATCH /events/:id` — 更新（無 scope 參數，Phase B 再加）
- `DELETE /events/:id` — 刪除

Business rules：
- calendar 需在 `calendarIds` 查詢參數內；user 需有 calendar 的 MEMBER 或 OWNER 身分（Phase A owner 即可）
- `isAllDay=true` 時 startAt/endAt 設為當天 midnight UTC

**DoD**：Postman CRUD；`GET /events` 正確回時間範圍內事件

---

### A4：Frontend 套件安裝與 lib 建立

**複雜度**：S

```bash
pnpm -C frontend add \
  @fullcalendar/react @fullcalendar/core \
  @fullcalendar/daygrid @fullcalendar/timegrid \
  @fullcalendar/list @fullcalendar/interaction
```

建立：
- `frontend/src/lib/calendars-api.ts` — `calendarsApi.list / get / create / update / remove`
- `frontend/src/lib/events-api.ts` — `eventsApi.list / get / create / update / remove`
  - `list` 接受 `{ start, end, calendarIds }`

**DoD**：`pnpm typecheck` 前端通過

---

### A5：CalendarSidebar 元件

**複雜度**：M

```
frontend/src/app/(main)/dashboard/calendar/_components/calendar-sidebar.tsx
```

- `useQuery` 取所有 calendars
- 每個行事曆顯示顏色圓點 + 名稱 + checkbox
- checkbox 狀態 → 更新本地 store（Zustand）+ debounce PATCH `/calendars/:id`（isVisible）
- hover 顯示設定選單（改名 / 改顏色 / 刪除）
- 底部「+ 建立行事曆」按鈕

**DoD**：勾掉行事曆後事件消失；重整 isVisible 狀態保留（從 DB 讀）

---

### A6：CalendarView 主視圖（FullCalendar）

**複雜度**：L

```
frontend/src/app/(main)/dashboard/calendar/
  page.tsx
  _components/
    calendar-view.tsx
    calendar-toolbar.tsx
```

- FullCalendar `eventSourceFunc` — range 變動時呼叫 `eventsApi.list({ start, end, calendarIds })`
- 事件顏色從 calendar 繼承（或 event 覆蓋）
- `initialView=dayGridMonth`；Toolbar 切換月/週/日/清單
- `editable=true`：`eventDrop` 觸發 PATCH；失敗時 `revert()`
- `selectable=true`：拖曳空白區域 → `onSelect` callback 帶入 startAt/endAt 開啟 EventFormModal

**DoD**：月曆顯示事件；切視圖正確；拖曳更新 DB

---

### A7：EventDetailPopover

**複雜度**：M

```
_components/event-detail-popover.tsx
```

- 點擊事件 → Popover（非 Dialog）顯示：
  - 標題、時間（格式化）、全天標記、地點、說明
  - 行事曆顏色標示
  - [編輯] [刪除] 按鈕
  - RSVP 區塊佔位（Phase C 實作）
- 點擊外部關閉

**DoD**：點擊事件 popover 正確顯示；刪除後月曆即時移除

---

### A8：EventFormModal（建立/編輯，非週期）

**複雜度**：L

```
_components/event-form-modal.tsx
```

RHF + Zod schema：
- 標題（必填）
- 行事曆選擇（AppSelect，動態從 calendars 撈）
- 開始 / 結束時間（DatetimePicker）
- 全天事件 Switch（切換後隱藏時間選擇器）
- 時區（Select，預設 Asia/Taipei）
- 地點（Input，選填）
- 說明（Textarea，選填）
- 事件顏色（Select，選填；null = 繼承行事曆色）
- 週期設定佔位（Phase B 實作）

**DoD**：建立 / 編輯走通；FullCalendar 即時刷新

---

### A9：Events 列表管理頁

**複雜度**：M

```
frontend/src/app/(main)/dashboard/events/page.tsx
```

沿用 template users 頁面模式：
- TanStack Table + server-side 搜尋 / 排序 / 分頁
- 顯示：標題、行事曆、開始時間、結束時間、全天
- 操作：新增（Dialog）、編輯（Dialog）、刪除（AlertDialog）

**DoD**：CRUD 走通；搜尋 / 排序正確

---

### A10：i18n + Breadcrumb

**複雜度**：S

`messages/zh-TW.json` + `en.json` 補充：
- `calendarView.*` — 行事曆視圖相關文字
- `events.*` — 事件欄位標籤
- `calendars.*` — 行事曆管理文字

`app-breadcrumb.tsx` `TRANSLATABLE_SEGMENTS` 已包含 `calendar`、`events`（建立 app 骨架時已加）。

**DoD**：所有新介面文字走 i18n；繁/英切換正確

---

## Phase B — 週期事件

> **目標**：RRULE 建立、展開、scope-aware 編輯/刪除

### B1：Schema 補充週期欄位

**複雜度**：S

`Event` model 新增：
- `recurringEventId String? @map("recurring_event_id")`
- `originalStartAt DateTime? @map("original_start_at")`
- `isCancelled Boolean @default(false) @map("is_cancelled")`

確認 `recurrenceRule String? @map("recurrence_rule")` 已存在（建立 app 骨架時已加）。

```bash
pnpm -C backend prisma:migrate  # --name add_recurrence_fields
```

**DoD**：migration 成功；Prisma client 重新 generate

---

### B2：ExpansionService（後端）

**複雜度**：L

```
backend/src/events/expansion.service.ts
backend/src/events/expansion.service.spec.ts
```

```bash
pnpm -C backend add rrule date-fns-tz
```

介面：
```typescript
expandMasterEvents(
  masters: Event[],
  overrides: Event[],
  cancellations: Event[],
  rangeStart: Date,
  rangeEnd: Date,
): EventOccurrence[]

interface EventOccurrence extends Event {
  occurrenceId: string   // masterId__ISO 或原 id
  originalStartAt: Date  // occurrence 原始起始時間
  isOverride: boolean
}
```

實作：
1. 對每個 master：用 `rrule` + `date-fns-tz` 在 `event.timezone` 內展開 range 內的 occurrences
2. 替換 overrides（依 `originalStartAt` 比對）
3. 移除 cancellations（依 `originalStartAt` 比對）

單元測試（至少 7 case）：
- 每週一展開 4 週 ✓
- DST 切換週（America/New_York，3 月第二個禮拜日）✓
- 月底 31 號月循環（跳過沒有 31 號的月份）✓
- EXDATE 排除（future scope DELETE 後）✓
- Override + Cancellation 同時存在 ✓
- INTERVAL=2（每兩週）✓
- COUNT=5（只展開 5 次）✓

**DoD**：所有單元測試通過；1 年範圍展開 < 150ms

---

### B3：GET /events 整合 expansion

**複雜度**：M

修改 `events.service.ts`：
1. 撈有 `recurrenceRule` 的 master events（在 range 內可能有 occurrence 的）
2. 撈這些 masters 的 overrides / cancellations
3. 呼叫 `ExpansionService.expandMasterEvents()`
4. 合併非週期事件，依 startAt 排序

**DoD**：`GET /events` 回傳週期事件的展開 occurrences；occurrence id 格式正確

---

### B4：POST /events 支援 RRULE

**複雜度**：S

`CreateEventDto` 新增：
- `recurrenceRule?: string` — RRULE 字串
- `timezone: string` — IANA tz（必填）

驗證：
- 若有 `recurrenceRule`，用 `rrule` 套件 parse 確認語法合法
- `UNTIL` 或 `COUNT` 至多一個

**DoD**：建「每週一 10:00」→ `GET /events` 展開正確

---

### B5：PATCH/DELETE scope-aware 邏輯

**複雜度**：L

`PATCH /events/:id?scope=THIS_ONLY|THIS_AND_FOLLOWING|ALL`
`DELETE /events/:id?scope=THIS_ONLY|THIS_AND_FOLLOWING|ALL`

`:id` 可以是：
- 原始 event id（master）
- Occurrence id `<masterId>__<ISO>`

Decode logic（在 service 層）：
- 若含 `__` → decode 出 masterId + originalStartAt
- 否則直接當 master id

Scope 實作：

| Scope | PATCH | DELETE |
|---|---|---|
| THIS_ONLY | 建 override row（複製 master，套用 changes，`recurringEventId=masterId`，`originalStartAt=...`）| 建 cancellation row（`isCancelled=true`）|
| THIS_AND_FOLLOWING | master 加 `UNTIL = originalStartAt - 1ms`；建新 master（繼承 rrule + changes）| master 加 `UNTIL = originalStartAt - 1ms` |
| ALL | 直接 update master | soft delete master + 所有 overrides/cancellations |

**DoD**：三種 scope e2e 各走通

---

### B6：RecurrenceScopeDialog（前端）

**複雜度**：M

```
_components/recurrence-scope-dialog.tsx
```

- 編輯或刪除週期 occurrence 時彈出 AlertDialog
- 三個 radio：「僅此次」/ 「此後所有」/ 「全部」
- 預設 `THIS_ONLY`
- 確認後傳 scope 給 PATCH/DELETE API

**DoD**：點擊週期事件的編輯/刪除 → scope dialog 出現；三種選項行為正確

---

### B7：RruleBuilder UI

**複雜度**：L

```
_components/rrule-builder.tsx
```

- 頻率下拉：不重複 / 每天 / 每週 / 每月 / 每年 / 自訂
- 每週時：星期幾 checkbox（一到日）
- 每月時：每月第 N 天 或 每月第幾個星期幾
- 間隔（每 N 天/週/月/年）
- 結束條件：永不 / 到某日期 / 共幾次
- 即時預覽：「接下來 5 次」列表（用 `rrule.js` 前端展開）
- 雙向：傳入既有 RRULE 字串 → 回填表單

**DoD**：常見場景（每週一三五、每月最後一個禮拜五）能組出正確 RRULE；parse 後回填正確

---

### B8：EventFormModal 加週期設定

**複雜度**：M

在 EventFormModal 下方加「重複」section：
- 「不重複」時隱藏（預設）
- 選擇頻率後展開 RruleBuilder
- 提交時附帶 `recurrenceRule`、`timezone`

**DoD**：建立週期事件走通；FullCalendar 展開正確

---

## Phase C — 行事曆分享 & 出席者 RSVP

> **目標**：多人共用行事曆；事件邀請與 RSVP；收件箱

### C1：CalendarMember Schema

**複雜度**：S

新增 `CalendarMember` model（見 `001-calendar-plan.md` 的 Schema 定義）

```bash
pnpm -C backend prisma:migrate  # --name add_calendar_members
```

**DoD**：migration 成功

---

### C2：CalendarMember API

**複雜度**：M

```
backend/src/calendars/members/
  dto/member.dto.ts
  members.service.ts
  members.controller.ts
```

端點：
- `POST /calendars/:id/members` — 邀請成員（body: userId, role）
- `PATCH /calendars/:id/members/:userId` — 更改角色
- `DELETE /calendars/:id/members/:userId` — 移除成員

Business rules：
- 只有 OWNER 可管理成員
- 自己不能移除自己（OWNER 不能轉讓給自己）

修改 `GET /calendars`：回傳 owner 的行事曆 + 有 CalendarMember 的行事曆

**DoD**：CRUD 走通；非 OWNER 管理成員回 403；分享後受邀方看得到行事曆

---

### C3：EventAttendee API 補完

**複雜度**：M

`POST /events` body 加 `attendeeIds?: string[]`：
- 建事件時若有 attendeeIds，批次建立 `EventAttendee`（status=PENDING）
- 建立者自動設為 isOrganizer=true、status=ACCEPTED

端點補充：
- `GET /events/:id/attendees`
- `POST /events/:id/rsvp` body: `{ status: AttendeeStatus }`
- `GET /events/my-invites` — 我的 PENDING 邀請列表

**DoD**：邀請流程走通；受邀者看到事件；RSVP 後狀態更新

---

### C4：FreeBusy API

**複雜度**：M

```
backend/src/freebusy/
  freebusy.service.ts
  freebusy.controller.ts
```

`GET /freebusy?userIds=a,b,c&start=&end=`

回傳：
```json
[
  { "userId": "a", "busy": [{ "start": "...", "end": "..." }] }
]
```

- 不回事件 title（隱私）
- Phase B 後補入週期展開的 occurrences

**DoD**：查詢回正確的忙碌時段

---

### C5：出席者選擇 + 衝突提示（前端）

**複雜度**：M

EventFormModal 補充：
- Attendees 多選（AppSelect / combobox，從 `GET /users` 撈系統用戶）
- 選好 startAt/endAt + attendees 後自動 `GET /freebusy` 查詢
- 有衝突 → 衝突用戶旁顯示警告 icon + tooltip

**DoD**：選出有衝突的 attendee → 紅色警告顯示

---

### C6：RSVP UI（前端）

**複雜度**：M

EventDetailPopover 補充：
- 若我是 attendee → 顯示 RSVP 按鈕（接受 / 暫定 / 拒絕）
- 顯示所有 attendees 的 RSVP 狀態（avatar + 狀態色）
- RSVP 後立即 invalidateQueries 更新

**DoD**：RSVP 點擊後 UI 即時更新

---

### C7：邀請收件箱頁面

**複雜度**：M

```
frontend/src/app/(main)/dashboard/calendar/inbox/page.tsx
```

- Header 右上 Bell icon 顯示 PENDING 邀請數量
- 頁面列出所有 PENDING 邀請（事件標題、時間、邀請人）
- 可直接 Accept / Decline
- Accept 後事件出現在月曆

**DoD**：受邀後 Bell 紅點；收件箱可回覆；Accept 後月曆出現事件

---

## 跨 Phase 持續 Checklist

每個 Phase 結束前確認：

- [ ] `pnpm typecheck`（前後端）無錯誤
- [ ] `pnpm -C backend check`（biome）通過
- [ ] 新 migration 名稱清楚（如 `add_calendar_members`）
- [ ] 新功能的 i18n key 已加到 zh-TW.json + en.json
- [ ] `docs/data-dictionary.md` 在有 schema 變動時重新生成（`pnpm -C backend schema:docs`）
- [ ] CLAUDE.md 如有新套件或新的開發指令，同步更新

---

## 風險矩陣

| 風險 | 機率 | 影響 | 緩解 |
|---|---|---|---|
| RRULE DST 邊界展開出錯 | 高 | 高 | B2 強制 unit test 覆蓋 DST case（America/New_York 3 月切換週） |
| `masterId__ISO` occurrence id 解析碰撞 | 低 | 高 | 確保 master id 不含 `__`（cuid 不會有此字元）|
| FullCalendar eventSource 重複打 API | 中 | 中 | 用 `calendarIds` param + TanStack Query cacheTime 做 dedup |
| 月底 31 號月循環展開邏輯 | 中 | 中 | B2 spec 覆蓋；rrule 套件本身處理此 edge case |
| CalendarColor enum 擴充困難 | 低 | 低 | Phase D 前不開放自訂色；enum 改 hex 時一次 migration |
| 拖曳事件失敗後 revert 不正確 | 中 | 中 | FullCalendar `revert()` callback + Optimistic update 標準模式 |
