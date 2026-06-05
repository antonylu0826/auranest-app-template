"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Plus, MapPin } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/i18n/provider";
import { calendarsApi, COLOR_HEX } from "@/lib/calendars-api";
import { eventsApi, type CalendarEvent, type RecurrenceScope } from "@/lib/events-api";
import { EventFormModal } from "../calendar/_components/event-form-modal";
import { EventDetailDialog } from "../calendar/_components/event-detail-dialog";

function getRangeForList() {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setFullYear(end.getFullYear() + 2);
  return { start: start.toISOString(), end: end.toISOString() };
}

const range = getRangeForList();

export default function EventsPage() {
  const t = useTranslations("events");
  const tc = useTranslations("common");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [formState, setFormState] = useState<{ open: boolean; event?: CalendarEvent; scope?: RecurrenceScope }>({ open: false });
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", range.start, range.end],
    queryFn: () => eventsApi.list(range),
    enabled: calendars.length > 0,
  });

  const filtered = events.filter((e) =>
    !search || e.title.toLowerCase().includes(search.toLowerCase()),
  );

  const grouped = filtered.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    const key = format(new Date(e.startAt), "yyyy-MM");
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const sortedMonths = Object.keys(grouped).sort();

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} {t("title").toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-56"
          />
          <Button size="sm" onClick={() => setFormState({ open: true })}>
            <Plus className="size-4 mr-1.5" />
            {t("newEvent")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm py-10 text-center">{tc("loading")}</div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground text-sm py-10 text-center">{t("noEvents")}</div>
      ) : (
        <div className="space-y-6">
          {sortedMonths.map((month) => (
            <section key={month}>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                {format(new Date(`${month}-01`), "yyyy年 MM月")}
              </h2>
              <div className="rounded-lg border divide-y">
                {grouped[month].map((event) => {
                  const color = event.color
                    ? COLOR_HEX[event.color]
                    : COLOR_HEX[event.calendar.color];
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                      onClick={() => setDetailEvent(event)}
                    >
                      <div
                        className="mt-1.5 size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{event.title}</span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {event.calendar.name}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                          <span>
                            {event.isAllDay
                              ? format(new Date(event.startAt), "MM/dd")
                              : `${format(new Date(event.startAt), "MM/dd HH:mm")} – ${format(new Date(event.endAt), "HH:mm")}`}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" /> {event.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

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
        scope={formState.scope}
        calendars={calendars}
        onClose={() => setFormState({ open: false })}
        onSaved={() => {
          setFormState({ open: false });
          qc.invalidateQueries({ queryKey: ["events"] });
        }}
      />
    </div>
  );
}
