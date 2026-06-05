"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Check, Eye, EyeOff } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n/provider";
import { type Calendar as CalendarModel, type CalendarColor, ALL_COLORS, COLOR_HEX, calendarsApi } from "@/lib/calendars-api";

interface CalendarSidebarProps {
  calendars: CalendarModel[];
  selectedCalendarIds: Set<string>;
  onToggleCalendar: (id: string) => void;
  currentDate: Date;
  onDateSelect: (date: Date) => void;
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  color: z.enum(["BLUE", "GREEN", "RED", "YELLOW", "PURPLE", "PINK", "TEAL", "GRAY"]),
});
type CreateForm = z.infer<typeof createSchema>;

function ColorPicker({ value, onChange }: { value: CalendarColor; onChange: (c: CalendarColor) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className="size-6 rounded-full flex items-center justify-center ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          style={{ backgroundColor: COLOR_HEX[c] }}
          onClick={() => onChange(c)}
        >
          {value === c && <Check className="size-3.5 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

function CreateCalendarDialog() {
  const t = useTranslations("calendars");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", color: "BLUE" },
  });

  const mutation = useMutation({
    mutationFn: calendarsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendars"] });
      setOpen(false);
      form.reset();
      toast.success(t("createCalendar"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) form.reset(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6 shrink-0">
          <Plus className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("createCalendar")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-1">
            <FormField
              control={form.control}
              name="name"
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
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("color")}</FormLabel>
                  <FormControl>
                    <ColorPicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? tc("creating") : tc("create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function CalendarSidebar({
  calendars,
  selectedCalendarIds,
  onToggleCalendar,
  currentDate,
  onDateSelect,
}: CalendarSidebarProps) {
  const t = useTranslations("calendars");
  const qc = useQueryClient();

  const toggleVisibility = useMutation({
    mutationFn: ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      calendarsApi.update(id, { isVisible }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendars"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <aside className="w-64 shrink-0 border-r flex flex-col bg-sidebar overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* Mini calendar */}
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={(d) => d && onDateSelect(d)}
            classNames={{
              root: "w-full",
              month_caption: "text-xs font-medium",
              day: "text-xs",
              nav: "[&_button]:size-6 [&_svg]:size-3",
            }}
          />

          {/* My Calendars */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("title")}
              </span>
              <CreateCalendarDialog />
            </div>
            <ul className="space-y-0.5">
              {calendars.map((cal) => {
                const isSelected = selectedCalendarIds.has(cal.id);
                return (
                  <li key={cal.id} className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-muted/50 group">
                    <button
                      type="button"
                      className="size-3.5 rounded-sm shrink-0 flex items-center justify-center border-2 transition-colors"
                      style={{
                        backgroundColor: isSelected ? COLOR_HEX[cal.color] : 'transparent',
                        borderColor: COLOR_HEX[cal.color],
                      }}
                      onClick={() => onToggleCalendar(cal.id)}
                      aria-label={isSelected ? `Hide ${cal.name}` : `Show ${cal.name}`}
                    >
                      {isSelected && <Check className="size-2.5 text-white" strokeWidth={3} />}
                    </button>
                    <span className="flex-1 text-sm truncate">{cal.name}</span>
                    <button
                      type="button"
                      className={cn(
                        "opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded",
                        "hover:bg-muted text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => toggleVisibility.mutate({ id: cal.id, isVisible: !cal.isVisible })}
                      title={cal.isVisible ? "Hide calendar" : "Show calendar"}
                    >
                      {cal.isVisible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </ScrollArea>

      <div className="p-3 border-t text-xs text-muted-foreground">
        {format(currentDate, "yyyy年MM月")}
      </div>
    </aside>
  );
}
