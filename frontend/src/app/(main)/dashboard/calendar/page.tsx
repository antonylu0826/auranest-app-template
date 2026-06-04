"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg, EventDropArg } from "@fullcalendar/core";
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import zhTwLocale from "@fullcalendar/core/locales/zh-tw";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/provider";
import { calendarsApi, COLOR_HEX } from "@/lib/calendars-api";
import {
  eventsApi,
  isRecurringEvent,
  type CalendarEvent,
  type RecurrenceScope,
  type UpdateEventInput,
} from "@/lib/events-api";
import { CalendarSidebar } from "./_components/calendar-sidebar";
import { EventFormModal } from "./_components/event-form-modal";
import { EventDetailDialog } from "./_components/event-detail-dialog";
import { RecurrenceScopeDialog } from "./_components/recurrence-scope-dialog";

interface FormState {
  open: boolean;
  event?: CalendarEvent;
  initialStart?: string;
  initialEnd?: string;
  initialAllDay?: boolean;
  scope?: RecurrenceScope;
}

interface PendingDrag {
  revert: () => void;
  eventId: string;
  data: UpdateEventInput;
}

/** Initial fetch window: start of this month through end of next month. */
function initialDateRange(): { start: string; end: string } {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setMonth(end.getMonth() + 2);
  end.setDate(0);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function CalendarPage() {
  const t = useTranslations("calendarView");
  const calendarRef = useRef<FullCalendar>(null);
  const qc = useQueryClient();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(initialDateRange);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [formState, setFormState] = useState<FormState>({ open: false });
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [pendingDrag, setPendingDrag] = useState<PendingDrag | null>(null);

  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
  });

  useEffect(() => {
    if (calendars.length === 0) return;
    setSelectedIds((prev) => {
      if (prev.size > 0) return prev;
      return new Set(calendars.map((c) => c.id));
    });
  }, [calendars]);

  const { data: events = [] } = useQuery({
    queryKey: ["events", dateRange.start, dateRange.end],
    queryFn: () => eventsApi.list({ start: dateRange.start, end: dateRange.end }),
    enabled: calendars.length > 0,
  });

  const fcEvents = useMemo(
    () =>
      events
        .filter((e) => selectedIds.has(e.calendarId))
        .map((e) => ({
          id: e.id,
          title: e.title,
          start: e.startAt,
          end: e.endAt,
          allDay: e.isAllDay,
          backgroundColor: e.color ? COLOR_HEX[e.color] : COLOR_HEX[e.calendar.color],
          borderColor: "transparent",
          textColor: "#ffffff",
          extendedProps: { event: e },
        })),
    [events, selectedIds],
  );

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setDateRange({ start: info.start.toISOString(), end: info.end.toISOString() });
    const mid = new Date((info.start.getTime() + info.end.getTime()) / 2);
    setCurrentDate(mid);
  }, []);

  const handleEventClick = useCallback((info: EventClickArg) => {
    const ev = info.event.extendedProps.event as CalendarEvent;
    setDetailEvent(ev);
  }, []);

  const handleDateClick = useCallback((info: DateClickArg) => {
    const start = info.date;
    const end = new Date(start.getTime() + 3600_000);
    setFormState({
      open: true,
      initialStart: start.toISOString(),
      initialEnd: end.toISOString(),
      initialAllDay: info.allDay,
    });
  }, []);

  // Recurring events need a scope prompt before moving; non-recurring ones save immediately.
  const applyEventMove = useCallback(
    (ev: CalendarEvent, data: UpdateEventInput, revert: () => void) => {
      if (isRecurringEvent(ev)) {
        setPendingDrag({ revert, eventId: ev.id, data });
      } else {
        eventsApi.update(ev.id, data, "ALL")
          .then(() => qc.invalidateQueries({ queryKey: ["events"] }))
          .catch((e: Error) => { revert(); toast.error(e.message); });
      }
    },
    [qc],
  );

  const handleEventDrop = useCallback((info: EventDropArg) => {
    const ev = info.event.extendedProps.event as CalendarEvent;
    const originalDuration = new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime();
    const newStart = info.event.start!;
    const newEnd = info.event.end ?? new Date(newStart.getTime() + originalDuration);
    applyEventMove(ev, {
      startAt: newStart.toISOString(),
      endAt: newEnd.toISOString(),
      isAllDay: info.event.allDay,
    }, info.revert);
  }, [applyEventMove]);

  const handleEventResize = useCallback((info: EventResizeDoneArg) => {
    const ev = info.event.extendedProps.event as CalendarEvent;
    applyEventMove(ev, {
      startAt: info.event.start!.toISOString(),
      endAt: info.event.end!.toISOString(),
    }, info.revert);
  }, [applyEventMove]);

  const handleMiniCalendarNavigate = useCallback((date: Date) => {
    calendarRef.current?.getApi().gotoDate(date);
    setCurrentDate(date);
  }, []);

  const handleToggleCalendar = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div data-content-padding="false" className="flex h-full overflow-hidden">
      <CalendarSidebar
        calendars={calendars}
        selectedCalendarIds={selectedIds}
        onToggleCalendar={handleToggleCalendar}
        currentDate={currentDate}
        onDateSelect={handleMiniCalendarNavigate}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-end px-4 py-2 border-b gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => setFormState({ open: true })}
          >
            <Plus className="size-4 mr-1.5" />
            {t("newEvent")}
          </Button>
        </div>

        <div className="flex-1 overflow-hidden p-1">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={zhTwLocale}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            buttonText={{
              today: t("today"),
              month: t("month"),
              week: t("week"),
              day: t("day"),
            }}
            events={fcEvents}
            datesSet={handleDatesSet}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            editable
            selectable
            selectMirror
            height="100%"
            eventDisplay="block"
            dayMaxEvents={4}
          />
        </div>
      </div>

      <EventDetailDialog
        event={detailEvent}
        open={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        onEdit={(scope) => {
          if (detailEvent) {
            setFormState({ open: true, event: detailEvent, scope });
            setDetailEvent(null);
          }
        }}
      />

      <EventFormModal
        open={formState.open}
        event={formState.event}
        initialStart={formState.initialStart}
        initialEnd={formState.initialEnd}
        initialAllDay={formState.initialAllDay}
        scope={formState.scope}
        calendars={calendars}
        onClose={() => setFormState({ open: false })}
        onSaved={() => {
          setFormState({ open: false });
          qc.invalidateQueries({ queryKey: ["events"] });
        }}
      />

      <RecurrenceScopeDialog
        open={pendingDrag !== null}
        action="edit"
        onCancel={() => {
          pendingDrag?.revert();
          setPendingDrag(null);
        }}
        onConfirm={async (scope) => {
          if (!pendingDrag) return;
          const { revert, eventId, data } = pendingDrag;
          setPendingDrag(null);
          try {
            await eventsApi.update(eventId, data, scope);
            qc.invalidateQueries({ queryKey: ["events"] });
          } catch (e) {
            revert();
            toast.error((e as Error).message);
          }
        }}
      />
    </div>
  );
}
