"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { useTranslations } from "@/i18n/provider";
import { type CalendarEvent, type RecurrenceScope, eventsApi } from "@/lib/events-api";
import { type Calendar, type CalendarColor, ALL_COLORS, COLOR_HEX } from "@/lib/calendars-api";
import { RruleBuilder } from "./rrule-builder";

const schema = z.object({
  title: z.string().min(1).max(200),
  calendarId: z.string().min(1),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  isAllDay: z.boolean().optional(),
  description: z.string().max(2000).optional(),
  location: z.string().max(500).optional(),
  color: z.enum(["BLUE", "GREEN", "RED", "YELLOW", "PURPLE", "PINK", "TEAL", "GRAY"]).optional(),
  recurrenceRule: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface EventFormModalProps {
  open: boolean;
  event?: CalendarEvent;
  initialStart?: string;
  initialEnd?: string;
  initialAllDay?: boolean;
  defaultCalendarId?: string;
  scope?: RecurrenceScope;
  calendars: Calendar[];
  onClose: () => void;
  onSaved: () => void;
}

function ColorPicker({ value, onChange }: { value?: CalendarColor; onChange: (c: CalendarColor | undefined) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className="size-6 rounded-full flex items-center justify-center ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          style={{ backgroundColor: COLOR_HEX[c] }}
          onClick={() => onChange(value === c ? undefined : c)}
          title={c}
        >
          {value === c && <Check className="size-3.5 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

export function EventFormModal({
  open,
  event,
  initialStart,
  initialEnd,
  initialAllDay,
  defaultCalendarId,
  scope,
  calendars,
  onClose,
  onSaved,
}: EventFormModalProps) {
  const t = useTranslations("events");
  const tc = useTranslations("common");
  const tr = useTranslations("recurrence");
  const isEditing = !!event;
  const [showRecurrence, setShowRecurrence] = useState(false);

  const primaryCalendar = calendars.find((c) => c.isPrimary);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      calendarId: defaultCalendarId ?? primaryCalendar?.id ?? "",
      startAt: initialStart ?? new Date().toISOString(),
      endAt: initialEnd ?? new Date(Date.now() + 3600_000).toISOString(),
      isAllDay: initialAllDay ?? false,
      description: "",
      location: "",
      color: undefined,
      recurrenceRule: undefined,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (event) {
      form.reset({
        title: event.title,
        calendarId: event.calendarId,
        startAt: event.startAt,
        endAt: event.endAt,
        isAllDay: event.isAllDay,
        description: event.description ?? "",
        location: event.location ?? "",
        color: event.color ?? undefined,
        recurrenceRule: event.recurrenceRule ?? undefined,
      });
      setShowRecurrence(!!event.recurrenceRule);
    } else {
      const cal = defaultCalendarId ?? primaryCalendar?.id ?? calendars[0]?.id ?? "";
      form.reset({
        title: "",
        calendarId: cal,
        startAt: initialStart ?? new Date().toISOString(),
        endAt: initialEnd ?? new Date(Date.now() + 3600_000).toISOString(),
        isAllDay: initialAllDay ?? false,
        description: "",
        location: "",
        color: undefined,
        recurrenceRule: undefined,
      });
      setShowRecurrence(false);
    }
  }, [open, event, initialStart, initialEnd, initialAllDay, defaultCalendarId, primaryCalendar, calendars, form]);

  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: eventsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success(t("createEvent"));
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data, sc }: { id: string; data: Parameters<typeof eventsApi.update>[1]; sc: RecurrenceScope }) =>
      eventsApi.update(id, data, sc),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success(t("editEvent"));
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const startAtValue = form.watch("startAt");
  const dtstart = startAtValue ? new Date(startAtValue) : new Date();

  // When scope is THIS_ONLY or THIS_AND_FOLLOWING, hide the recurrence builder
  // (those scopes create exceptions, not a new series)
  const canEditRecurrence = !scope || scope === "ALL";

  function onSubmit(values: FormValues) {
    const payload = {
      title: values.title,
      calendarId: values.calendarId,
      startAt: values.startAt,
      endAt: values.endAt,
      isAllDay: values.isAllDay,
      description: values.description || undefined,
      location: values.location || undefined,
      color: values.color,
      recurrenceRule: canEditRecurrence ? (values.recurrenceRule || undefined) : undefined,
    };
    if (isEditing && event) {
      updateMutation.mutate({ id: event.id, data: payload, sc: scope ?? "ALL" });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("editEvent") : t("createEvent")}
            {scope && scope !== "ALL" && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                （{tr(`scope.${scope}`)}）
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("namePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="calendarId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("calendar")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {calendars.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("startAt")}</FormLabel>
                    <FormControl>
                      <DateTimePicker value={field.value} onChange={(v) => field.onChange(v ?? "")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("endAt")}</FormLabel>
                    <FormControl>
                      <DateTimePicker value={field.value} onChange={(v) => field.onChange(v ?? "")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isAllDay"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">{t("allDay")}</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("location")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("locationPlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("descriptionPlaceholder")}
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Controller
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("color")}</FormLabel>
                  <FormControl>
                    <ColorPicker
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Recurrence section */}
            {canEditRecurrence && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                  onClick={() => setShowRecurrence((v) => !v)}
                >
                  <span>{tr("section")}</span>
                  {showRecurrence ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {showRecurrence && (
                  <div className="px-3 pb-3 pt-2 border-t">
                    <Controller
                      control={form.control}
                      name="recurrenceRule"
                      render={({ field }) => (
                        <RruleBuilder
                          value={field.value}
                          onChange={field.onChange}
                          dtstart={dtstart}
                        />
                      )}
                    />
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tc("saving") : tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
