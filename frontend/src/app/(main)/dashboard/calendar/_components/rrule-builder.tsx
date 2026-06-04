"use client";

import { useEffect, useMemo, useState } from "react";
import { RRule } from "rrule";
import { format } from "date-fns";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { useTranslations } from "@/i18n/provider";

type Freq = "none" | "daily" | "weekly" | "monthly" | "yearly";
type EndType = "never" | "until" | "count";

const WEEKDAYS = [
  { key: "MO", label: "一" },
  { key: "TU", label: "二" },
  { key: "WE", label: "三" },
  { key: "TH", label: "四" },
  { key: "FR", label: "五" },
  { key: "SA", label: "六" },
  { key: "SU", label: "日" },
] as const;

interface RruleBuilderProps {
  value: string | undefined;
  onChange: (rrule: string | undefined) => void;
  dtstart: Date;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromDateString(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 12);
}

function parseExisting(rrule: string | undefined, dtstart: Date): {
  freq: Freq;
  interval: number;
  weekdays: string[];
  monthDay: number;
  endType: EndType;
  until: string | undefined;
  count: number;
} {
  const defaults = {
    freq: "none" as Freq,
    interval: 1,
    weekdays: [dtstart ? ["SU","MO","TU","WE","TH","FR","SA"][dtstart.getDay()] : "MO"],
    monthDay: dtstart?.getDate() ?? 1,
    endType: "never" as EndType,
    until: undefined as string | undefined,
    count: 10,
  };

  if (!rrule) return defaults;

  try {
    const rule = RRule.fromString(rrule);
    const opts = rule.origOptions;

    const freqMap: Record<number, Freq> = {
      [RRule.DAILY]: "daily",
      [RRule.WEEKLY]: "weekly",
      [RRule.MONTHLY]: "monthly",
      [RRule.YEARLY]: "yearly",
    };
    const freq = opts.freq !== undefined ? (freqMap[opts.freq] ?? "none") : "none";

    const weekdays =
      Array.isArray(opts.byweekday)
        ? opts.byweekday.map((w) => {
            const names = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
            const wday = typeof w === "number" ? w : (w as { weekday: number }).weekday;
            return names[wday] ?? "MO";
          })
        : defaults.weekdays;

    return {
      freq,
      interval: opts.interval ?? 1,
      weekdays,
      monthDay: Array.isArray(opts.bymonthday) ? (opts.bymonthday[0] ?? defaults.monthDay) : defaults.monthDay,
      endType: opts.until ? "until" : opts.count ? "count" : "never",
      until: opts.until ? toDateString(new Date(opts.until)) : undefined,
      count: opts.count ?? 10,
    };
  } catch {
    return defaults;
  }
}

function buildRrule(
  freq: Freq,
  interval: number,
  weekdays: string[],
  monthDay: number,
  endType: EndType,
  until: string | undefined,
  count: number,
): string | undefined {
  if (freq === "none") return undefined;

  const freqMap: Record<Freq, number | undefined> = {
    none: undefined,
    daily: RRule.DAILY,
    weekly: RRule.WEEKLY,
    monthly: RRule.MONTHLY,
    yearly: RRule.YEARLY,
  };

  const opts: ConstructorParameters<typeof RRule>[0] = {
    freq: freqMap[freq]!,
    interval: interval > 1 ? interval : undefined,
  };

  if (freq === "weekly" && weekdays.length > 0) {
    const wdMap: Record<string, ReturnType<typeof RRule.MO.nth>> = {
      MO: RRule.MO, TU: RRule.TU, WE: RRule.WE, TH: RRule.TH,
      FR: RRule.FR, SA: RRule.SA, SU: RRule.SU,
    };
    opts.byweekday = weekdays.map((w) => wdMap[w]).filter(Boolean);
  }

  if (freq === "monthly") {
    opts.bymonthday = [monthDay];
  }

  if (endType === "until" && until) {
    opts.until = fromDateString(until);
  } else if (endType === "count" && count > 0) {
    opts.count = count;
  }

  try {
    const rule = new RRule(opts);
    const str = rule.toString();
    const match = str.match(/RRULE:(.+)/);
    return match ? match[1] : str;
  } catch {
    return undefined;
  }
}

function getPreview(rrule: string | undefined, dtstart: Date): string[] {
  if (!rrule) return [];
  try {
    const rule = new RRule({ ...RRule.parseString(rrule), dtstart, count: 5 });
    return rule.all().map((d) => format(d, "yyyy/MM/dd HH:mm"));
  } catch {
    return [];
  }
}

export function RruleBuilder({ value, onChange, dtstart }: RruleBuilderProps) {
  const t = useTranslations("recurrence");
  const parsed = useMemo(() => parseExisting(value, dtstart), [value, dtstart]);

  const [freq, setFreq] = useState<Freq>(parsed.freq);
  const [interval, setInterval] = useState(parsed.interval);
  const [weekdays, setWeekdays] = useState<string[]>(parsed.weekdays);
  const [monthDay, setMonthDay] = useState(parsed.monthDay);
  const [endType, setEndType] = useState<EndType>(parsed.endType);
  const [until, setUntil] = useState<string | undefined>(parsed.until);
  const [count, setCount] = useState(parsed.count);

  const rrule = useMemo(
    () => buildRrule(freq, interval, weekdays, monthDay, endType, until, count),
    [freq, interval, weekdays, monthDay, endType, until, count],
  );

  const preview = useMemo(() => getPreview(rrule, dtstart), [rrule, dtstart]);

  useEffect(() => {
    onChange(rrule);
  }, [rrule, onChange]);

  const FREQ_ORDER: Freq[] = ["none", "daily", "weekly", "monthly", "yearly"];

  const toggleWeekday = (key: string) => {
    setWeekdays((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((w) => w !== key) : prev) : [...prev, key],
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="w-14 shrink-0 text-sm">{t("frequency")}</Label>
        <Select value={freq} onValueChange={(v) => setFreq(v as Freq)}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQ_ORDER.map((f) => (
              <SelectItem key={f} value={f}>{t(`freq.${f}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {freq !== "none" && (
          <>
            <Label className="text-sm shrink-0">{t("every")}</Label>
            <Input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => setInterval(Math.max(1, Number(e.target.value)))}
              className="w-16 h-8 text-sm"
            />
            <span className="text-sm text-muted-foreground shrink-0">
              {t(`unit.${freq}`)}
            </span>
          </>
        )}
      </div>

      {freq === "weekly" && (
        <div className="flex items-center gap-1 ml-16">
          {WEEKDAYS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleWeekday(key)}
              className={`size-7 text-xs rounded-full border transition-colors ${
                weekdays.includes(key)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {freq === "monthly" && (
        <div className="flex items-center gap-2 ml-16">
          <Label className="text-sm shrink-0">{t("monthDayPrefix")}</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={monthDay}
            onChange={(e) => setMonthDay(Math.min(31, Math.max(1, Number(e.target.value))))}
            className="w-16 h-8 text-sm"
          />
          <Label className="text-sm shrink-0">{t("monthDaySuffix")}</Label>
        </div>
      )}

      {freq !== "none" && (
        <div className="flex items-center gap-2">
          <Label className="w-14 shrink-0 text-sm">{t("end")}</Label>
          <Select value={endType} onValueChange={(v) => setEndType(v as EndType)}>
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="never">{t("endType.never")}</SelectItem>
              <SelectItem value="until">{t("endType.until")}</SelectItem>
              <SelectItem value="count">{t("endType.count")}</SelectItem>
            </SelectContent>
          </Select>

          {endType === "until" && (
            <DatePicker
              value={until}
              onChange={setUntil}
              placeholder={t("untilPlaceholder")}
              className="h-8 text-sm"
            />
          )}
          {endType === "count" && (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={999}
                value={count}
                onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
                className="w-20 h-8 text-sm"
              />
              <span className="text-sm text-muted-foreground">{t("times")}</span>
            </div>
          )}
        </div>
      )}

      {preview.length > 0 && (
        <div className="ml-16 text-xs text-muted-foreground space-y-0.5">
          <div className="font-medium mb-1">{t("previewHeader").replace("{count}", String(preview.length))}</div>
          {preview.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
      )}
    </div>
  );
}
