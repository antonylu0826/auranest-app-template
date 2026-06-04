import { Injectable } from '@nestjs/common';
import { RRule } from 'rrule';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { Event, CalendarColor } from '@prisma/client';

type CalendarRef = { id: string; name: string; color: CalendarColor };

export interface EventOccurrence
  extends Omit<Event, 'startAt' | 'endAt' | 'originalStartAt' | 'createdAt' | 'updatedAt'> {
  startAt: Date;
  endAt: Date;
  originalStartAt: Date;
  createdAt: Date;
  updatedAt: Date;
  calendar: CalendarRef;
  isOverride: boolean;
}

type PrismaEventWithCalendar = Event & { calendar: CalendarRef };

@Injectable()
export class ExpansionService {
  expandMasterEvents(
    masters: PrismaEventWithCalendar[],
    overrides: PrismaEventWithCalendar[],
    cancellations: PrismaEventWithCalendar[],
    rangeStart: Date,
    rangeEnd: Date,
  ): EventOccurrence[] {
    const result: EventOccurrence[] = [];

    for (const master of masters) {
      result.push(...this.expandSingle(master, overrides, cancellations, rangeStart, rangeEnd));
    }

    return result.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }

  private expandSingle(
    master: PrismaEventWithCalendar,
    overrides: PrismaEventWithCalendar[],
    cancellations: PrismaEventWithCalendar[],
    rangeStart: Date,
    rangeEnd: Date,
  ): EventOccurrence[] {
    if (!master.recurrenceRule) return [];

    const tz = master.timezone;
    const masterStart = new Date(master.startAt);
    const duration = new Date(master.endAt).getTime() - masterStart.getTime();

    const dtstart = this.toFloating(masterStart, tz);

    let rule: RRule;
    try {
      rule = new RRule({ ...RRule.parseString(master.recurrenceRule), dtstart });
    } catch {
      return [];
    }

    const rruleStart = this.toFloating(rangeStart, tz);
    const rruleEnd = this.toFloating(rangeEnd, tz);
    const rawDates = rule.between(rruleStart, rruleEnd, true);

    // Build lookup maps for overrides and cancellations keyed by originalStartAt ISO
    const overrideMap = new Map<string, PrismaEventWithCalendar>();
    const cancelSet = new Set<string>();

    for (const ov of overrides) {
      if (ov.recurringEventId === master.id && ov.originalStartAt) {
        overrideMap.set(new Date(ov.originalStartAt).toISOString(), ov);
      }
    }
    for (const can of cancellations) {
      if (can.recurringEventId === master.id && can.originalStartAt) {
        cancelSet.add(new Date(can.originalStartAt).toISOString());
      }
    }

    const occurrences: EventOccurrence[] = [];

    for (const floatingDate of rawDates) {
      const startUtc = this.fromFloating(floatingDate, tz);
      const key = startUtc.toISOString();

      if (cancelSet.has(key)) continue;

      if (overrideMap.has(key)) {
        const ov = overrideMap.get(key)!;
        occurrences.push({
          ...ov,
          id: `${master.id}__${key}`,
          startAt: new Date(ov.startAt),
          endAt: new Date(ov.endAt),
          originalStartAt: startUtc,
          createdAt: new Date(ov.createdAt),
          updatedAt: new Date(ov.updatedAt),
          isOverride: true,
        });
      } else {
        const endUtc = new Date(startUtc.getTime() + duration);
        occurrences.push({
          ...master,
          id: `${master.id}__${key}`,
          startAt: startUtc,
          endAt: endUtc,
          originalStartAt: startUtc,
          createdAt: new Date(master.createdAt),
          updatedAt: new Date(master.updatedAt),
          isOverride: false,
        });
      }
    }

    return occurrences;
  }

  /** Convert a real UTC date to a "floating" UTC date whose year/month/day/hour/min/sec
   *  match the local time in the given timezone (rrule works with floating dates). */
  toFloating(utcDate: Date, timezone: string): Date {
    const local = toZonedTime(utcDate, timezone);
    return new Date(
      Date.UTC(
        local.getFullYear(),
        local.getMonth(),
        local.getDate(),
        local.getHours(),
        local.getMinutes(),
        local.getSeconds(),
        local.getMilliseconds(),
      ),
    );
  }

  /** Convert a rrule "floating" date (local time stored as UTC) back to real UTC. */
  fromFloating(floatingDate: Date, timezone: string): Date {
    // Interpret the UTC fields as local time components
    const y = floatingDate.getUTCFullYear();
    const mo = String(floatingDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(floatingDate.getUTCDate()).padStart(2, '0');
    const h = String(floatingDate.getUTCHours()).padStart(2, '0');
    const mi = String(floatingDate.getUTCMinutes()).padStart(2, '0');
    const s = String(floatingDate.getUTCSeconds()).padStart(2, '0');
    return fromZonedTime(`${y}-${mo}-${d}T${h}:${mi}:${s}`, timezone);
  }

  /** Build a clean RRULE string (no DTSTART) from RRule options. */
  buildRruleString(options: ConstructorParameters<typeof RRule>[0]): string {
    const { dtstart: _dtstart, ...rest } = options as Record<string, unknown>;
    const rule = new RRule(rest as ConstructorParameters<typeof RRule>[0]);
    // rrule.toString() may prefix "DTSTART:…\nRRULE:" — strip it
    const str = rule.toString();
    const match = str.match(/RRULE:(.+)/);
    return match ? match[1] : str;
  }
}
