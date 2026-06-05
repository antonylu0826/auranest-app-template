"use client";

import { useState } from "react";
import { format } from "date-fns";
import { MapPin, FileText, Calendar, Clock, Pencil, Trash2, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslations } from "@/i18n/provider";
import { type CalendarEvent, type RecurrenceScope, eventsApi, isRecurringEvent } from "@/lib/events-api";
import { COLOR_HEX } from "@/lib/calendars-api";
import { RecurrenceScopeDialog } from "./recurrence-scope-dialog";

interface EventDetailDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
  onEdit: (scope?: RecurrenceScope) => void;
}

export function EventDetailDialog({ event, open, onClose, onEdit }: EventDetailDialogProps) {
  const t = useTranslations("events");
  const tc = useTranslations("common");
  const tr = useTranslations("recurrence");
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scopeDialog, setScopeDialog] = useState<"edit" | "delete" | null>(null);

  const deleteMutation = useMutation({
    mutationFn: ({ id, scope }: { id: string; scope: RecurrenceScope }) =>
      eventsApi.remove(id, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success(t("deleteEvent"));
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!event) return null;

  const isRecurring = isRecurringEvent(event);
  const color = event.color ? COLOR_HEX[event.color] : COLOR_HEX[event.calendar.color];

  const startDate = new Date(event.startAt);
  const endDate = new Date(event.endAt);
  const isSameDay = format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd");

  const timeStr = event.isAllDay
    ? format(startDate, "yyyy/MM/dd")
    : isSameDay
      ? `${format(startDate, "yyyy/MM/dd HH:mm")} – ${format(endDate, "HH:mm")}`
      : `${format(startDate, "yyyy/MM/dd HH:mm")} – ${format(endDate, "yyyy/MM/dd HH:mm")}`;

  function handleDeleteClick() {
    if (isRecurring) {
      setScopeDialog("delete");
    } else {
      setConfirmDelete(true);
    }
  }

  function handleEditClick() {
    if (isRecurring) {
      setScopeDialog("edit");
    } else {
      onEdit();
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 size-3 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base leading-snug">{event.title}</DialogTitle>
                {isRecurring && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <RefreshCw className="size-3" /> {tr("recurringEvent")}
                  </span>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 text-muted-foreground">
              <Clock className="size-4 mt-0.5 shrink-0" />
              <span>{timeStr}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Calendar className="size-4 shrink-0" />
              <span>{event.calendar.name}</span>
            </div>
            {event.location && (
              <div className="flex items-start gap-3 text-muted-foreground">
                <MapPin className="size-4 mt-0.5 shrink-0" />
                <span>{event.location}</span>
              </div>
            )}
            {event.description && (
              <div className="flex items-start gap-3 text-muted-foreground">
                <FileText className="size-4 mt-0.5 shrink-0" />
                <span className="whitespace-pre-wrap break-words">{event.description}</span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDeleteClick}
            >
              <Trash2 className="size-4 mr-1.5" />
              {tc("delete")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleEditClick}>
              <Pencil className="size-4 mr-1.5" />
              {tc("edit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Non-recurring delete confirm */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteEvent")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ id: event.id, scope: "ALL" })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recurring scope dialog */}
      <RecurrenceScopeDialog
        open={scopeDialog !== null}
        action={scopeDialog ?? "delete"}
        onCancel={() => setScopeDialog(null)}
        onConfirm={(scope) => {
          setScopeDialog(null);
          if (scopeDialog === "delete") {
            deleteMutation.mutate({ id: event.id, scope });
          } else {
            onEdit(scope);
          }
        }}
      />
    </>
  );
}
