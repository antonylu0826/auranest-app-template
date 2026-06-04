# AuraNest Calendar V2 — Task Breakdown

> **規劃者**：claude-sonnet-4-6
> **參考**：V0 `dev_docs/calendar-task-breakdown.md`、`001-calendar-plan.md`
> **複雜度**：S = 半天內　M = 1–2 天　L = 3 天以上

---

## 前置決策（已拍板）

| # | 決議 |
|---|---|
| D1 | RRULE 展開全部在後端；API 回展開後的 occurrence 陣列 |
| D2 | Occurrence ID 格式：`<masterId>__<UTC ISO8601>`（雙底線分隔）|
| D3 | 時區用 `date-fns-tz`（不用 luxon）；Event.timezone 存 IANA tz name |
| D4 | Override = 建新 Event row（`recurringEventId`）；Cancellation = isCancelled=true |
| D5 | `THIS_AND_FOLLOWING` = 截斷原 master（加 UNTIL）+ 建新 master |
| D6 | CalendarColor 維持 enum（8 色預定義）；Phase D 再考慮開放 hex |
| D7 | 不做 Socket.io；用 TanStack Query invalidateQueries 替代即時同步 |
| D8 | 首次登入自動建立「個人」預設行事曆（isPrimary=true，不可刪）|

---

## Phase A — 基礎 CRUD + FullCalendar UI ✅ 已完成

> **目標**：月曆可以用，非週期事件 CRUD 完整，拖曳可操作

### A1：Schema 擴充與 Migration ✅

新增 enum 與欄位：
- `CalendarType`（PERSONAL / SHARED）
- `EventStatus`（CONFIRMED / TENTATIVE / CANCELLED）
- `EventPrivacy`（DEFAULT / PUBLIC / PRIVATE）
- `Event.timezone String @default("Asia/Taipei")`
- `Calendar.isPrimary Boolean @default(false)`（原設計為 isDefault，實作改為 isPrimary）

---

### A2：CalendarsModule（後端）✅

```
backend/src/calendars/
  dto/calendar.dto.ts
  calendars.service.ts
  calendars.controller.ts
  calendars.module.ts
```

- `GET /calendars` — 列出我的行事曆
- `POST /calendars` — 建立
- `GET /calendars/:id` — 取得單一
- `PATCH /calendars/:id` — 更新名稱 / 顏色 / isVisible
- `DELETE /calendars/:id` — 刪除（isPrimary=true 拒絕）
- `ensurePrimaryCalendar(userId)`：首次 GET 時 lazy 建立預設個人行事曆

---

### A3：EventsModule（後端，非週期）✅

```
backend/src/events/
  dto/event.dto.ts
  events.service.ts
  events.controller.ts
  events.module.ts
```

- `GET /events?start=&end=&calendarIds=`
- `POST /events`
- `GET /events/:id`
- `PATCH /events/:id`
- `DELETE /events/:id`

---

### A4：Frontend 套件安裝與 lib 建立 ✅

安裝：`@fullcalendar/react` `@fullcalendar/core` `@fullcalendar/daygrid` `@fullcalendar/timegrid` `@fullcalendar/interaction` `date-fns-tz`

建立：
- `frontend/src/lib/calendars-api.ts` — `CalendarColor`、`COLOR_HEX`、`ALL_COLORS`、`calendarsApi`
- `frontend/src/lib/events-api.ts` — `CalendarEvent`、`isRecurringEvent()`、`eventsApi`

---

### A5：CalendarSidebar 元件 ✅

```
_components/calendar-sidebar.tsx
```

- `react-day-picker` mini 月曆，點選日期跳轉 FullCalendar
- 行事曆列表：顏色圓點 + 名稱 + checkbox（切顯示/隱藏）
- `CreateCalendarDialog`：名稱 + 顏色選擇
- isVisible PATCH on toggle

---

### A6：CalendarView 主視圖（FullCalendar）✅

```
frontend/src/app/(main)/dashboard/calendar/page.tsx
```

- FullCalendar 月/週/日三視圖，zh-TW locale
- `datesSet` → 更新查詢範圍
- 事件顏色從 calendar 繼承（或 event 覆蓋）
- `eventClick` → 開啟 EventDetailDialog
- `dateClick` → 開啟 EventFormModal（帶入預填時間）

---

### A7：EventDetailDialog ✅

```
_components/event-detail-dialog.tsx
```

> 原計畫為 Popover，實作改為 Dialog，行動裝置體驗更佳。

- 顯示：標題、時間（格式化）、全天、地點、說明、行事曆名稱
- 週期事件顯示 RefreshCw badge
- [編輯] → 若週期事件先走 RecurrenceScopeDialog
- [刪除] → 若週期事件先走 RecurrenceScopeDialog；非週期事件走 AlertDialog

---

### A8：EventFormModal（建立/編輯）✅

```
_components/event-form-modal.tsx
```

RHF + Zod schema（含 `recurrenceRule` 欄位）：
- 標題、行事曆（Select）、開始/結束時間（DateTimePicker）、全天 Checkbox
- 地點、說明、事件顏色（ColorPicker）
- 「重複」折疊區塊（ChevronDown/Up），內嵌 RruleBuilder
- `scope` prop：THIS_ONLY / THIS_AND_FOLLOWING 時隱藏週期設定區塊
- 標題欄旁顯示 scope 中文標籤

---

### A9：Events 列表管理頁 ✅

```
frontend/src/app/(main)/dashboard/events/page.tsx
```

- 事件依月份分組顯示
- 搜尋過濾（標題）
- 點擊 row → EventDetailDialog
- 「+ 新增活動」→ EventFormModal

---

### A10：i18n + Breadcrumb ✅（部分）

`messages/zh-TW.json` + `en.json` 已補充 `calendarView`、`events`、`calendars` namespace 的主要翻譯 key。部分 UI 文字（週期相關）仍為硬碼中文，待 Phase C 前補齊。

---

## Phase B — 週期事件 ✅ 已完成

> **目標**：RRULE 建立、展開、scope-aware 編輯/刪除

### B1：Schema 補充週期欄位 ✅

`Event` model 新增：
- `recurringEventId String? @map("recurring_event_id")`
- `originalStartAt DateTime? @map("original_start_at")`
- `isCancelled Boolean @default(false) @map("is_cancelled")`

`recurrenceRule String? @map("recurrence_rule")` 原已存在。

---

### B2：ExpansionService（後端）✅

```
backend/src/events/expansion.service.ts
```

**Floating datetime 方式**（rrule.js 工作原理）：
- `toFloating(utcDate, tz)`：UTC Date → local time components 重包為 UTC（rrule 內部格式）
- `fromFloating(floatingDate, tz)`：local-as-UTC → 真實 UTC（via `fromZonedTime`）

核心方法：
- `expandMasterEvents(masters, overrides, cancellations, rangeStart, rangeEnd): EventOccurrence[]`
- `buildRruleString(options): string`（剝掉 DTSTART，只存 RRULE 部分）

---

### B3：GET /events 整合 expansion ✅

修改 `events.service.ts`：
1. 撈有 `recurrenceRule` 的 master events
2. 撈對應的 overrides / cancellations
3. 呼叫 `ExpansionService.expandMasterEvents()`
4. 合併非週期事件，依 startAt 排序

---

### B4：POST /events 支援 RRULE ✅

`CreateEventDto` 新增 `recurrenceRule?: string`。
建立時若有 `recurrenceRule` → 用 `RRule.fromString()` 驗證語法合法。

---

### B5：PATCH/DELETE scope-aware 邏輯 ✅

`PATCH /events/:id?scope=THIS_ONLY|THIS_AND_FOLLOWING|ALL`
`DELETE /events/:id?scope=THIS_ONLY|THIS_AND_FOLLOWING|ALL`

`parseId(id)` 解析 occurrence id（含 `__` 則 split 出 masterId + originalStartAt）。

| Scope | PATCH | DELETE |
|---|---|---|
| THIS_ONLY | 建 override row | 建 cancellation row（isCancelled=true）|
| THIS_AND_FOLLOWING | master 加 UNTIL；建新 master | master 加 UNTIL；刪未來 overrides |
| ALL | 直接 update master | 刪 master + 所有 overrides/cancellations |

---

### B6：RecurrenceScopeDialog（前端）✅

```
_components/recurrence-scope-dialog.tsx
```

- AlertDialog，3 個 radio：僅此次 / 此後所有 / 全部
- 預設 `THIS_ONLY`
- `action: "edit" | "delete"` 控制按鈕文字與樣式（delete 為 destructive）

---

### B7：RruleBuilder UI ✅

```
_components/rrule-builder.tsx
```

- 頻率 Select：不重複 / 每天 / 每週 / 每月 / 每年
- 間隔 Input（每 N 天/週/月/年）
- 每週：7 個圓形 toggle button（一到日），至少保留一個
- 每月：bymonthday number input（1-31）
- 結束條件 Select：永不 / 到日期（DatePicker）/ 共幾次（Input）
- 即時預覽：「接下來 N 次」
- `parseExisting(rrule, dtstart)`：既有 RRULE 字串 → 回填表單狀態
- `until` 狀態型別為 `string | undefined`（YYYY-MM-DD），符合 DatePicker prop

---

### B8：EventFormModal 加週期設定 ✅

- 「重複」折疊區塊（ChevronDown/Up toggle）
- 展開後顯示 RruleBuilder
- `scope` prop：THIS_ONLY / THIS_AND_FOLLOWING 時隱藏整個週期設定區塊
- update mutation 傳入 scope 參數

---

## 拖曳移動/調整事件 ✅ 已完成（2026-06-04）

> 原規劃在 Phase A，隨 Phase B 完成後一併補上

`calendar/page.tsx` 新增：
- `editable` prop on FullCalendar
- `handleEventDrop(info: EventDropArg)` — 計算新 startAt/endAt（含 duration 保留），非週期直接 PATCH，週期事件彈出 RecurrenceScopeDialog
- `handleEventResize(info: EventResizeDoneArg)` — 同上，使用新 endAt
- `PendingDrag` state：`{ revert, eventId, data }` — 暫存待 scope 確認的拖曳資訊
- API 失敗時自動 `revert()` 回原位並 toast error

---

## Phase C — 行事曆分享 & 出席者 RSVP

> **目標**：多人共用行事曆；事件邀請與 RSVP；收件箱

### C1：CalendarMember Schema

新增 `CalendarMember` model（見 `001-calendar-plan.md`）

### C2：CalendarMember API

```
POST   /calendars/:id/members
PATCH  /calendars/:id/members/:userId
DELETE /calendars/:id/members/:userId
```

修改 `GET /calendars`：回傳 owner 的行事曆 + 有 CalendarMember 的行事曆

### C3：EventAttendee API 補完

`POST /events` body 加 `attendeeIds?: string[]`；
`GET /events/:id/attendees`；
`POST /events/:id/rsvp`；
`GET /events/my-invites`

### C4：FreeBusy API

`GET /freebusy?userIds=a,b,c&start=&end=`（只回 busy 時段，不回 title）

### C5：出席者選擇 + 衝突提示（前端）

EventFormModal 加 Attendees combobox + FreeBusy 衝突警告 icon

### C6：RSVP UI（前端）

EventDetailDialog 加 RSVP 按鈕 + 出席者狀態列表

### C7：邀請收件箱頁面

`/dashboard/calendar/inbox/page.tsx`；Header Bell icon 顯示 PENDING 數量

---

## 跨 Phase 持續 Checklist

- [x] `pnpm typecheck`（前後端）無錯誤 — Phase A + B 通過
- [ ] `pnpm -C backend check`（biome）通過
- [x] 新 migration 名稱清楚
- [ ] 新功能的 i18n key 已加到 zh-TW.json + en.json（週期相關部分仍為硬碼中文）
- [ ] `docs/data-dictionary.md` schema 變動後重新生成（`pnpm -C backend schema:docs`）

---

## 風險矩陣

| 風險 | 機率 | 影響 | 緩解 | 狀態 |
|---|---|---|---|---|
| RRULE DST 邊界展開出錯 | 高 | 高 | floating datetime 方式；date-fns-tz toZonedTime/fromZonedTime | ✅ 已處理 |
| `masterId__ISO` occurrence id 解析碰撞 | 低 | 高 | cuid 不含 `__`，安全 | ✅ 已確認 |
| FullCalendar eventSource 重複打 API | 中 | 中 | TanStack Query cacheTime + dateRange state 去重 | ✅ 已處理 |
| 月底 31 號月循環展開邏輯 | 中 | 中 | rrule 套件本身處理此 edge case | ✅ 套件負責 |
| 拖曳事件失敗後 revert 不正確 | 中 | 中 | FullCalendar `revert()` callback；週期事件先暫存再確認 | ✅ 已處理 |
| CalendarColor enum 擴充困難 | 低 | 低 | Phase D 前不開放自訂色 | 觀望中 |
