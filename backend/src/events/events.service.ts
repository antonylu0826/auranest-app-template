import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RRule } from 'rrule';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarsService } from '../calendars/calendars.service';
import {
  CreateEventDto,
  ListEventsQuery,
  RecurrenceScope,
  UpdateEventDto,
  validateRrule,
} from './dto/event.dto';
import { ExpansionService } from './expansion.service';

const OCCURRENCE_SEP = '__';

const EVENT_INCLUDE = { calendar: { select: { id: true, name: true, color: true } } } as const;

function parseId(id: string): { masterId: string; originalStartAt: Date } | null {
  const idx = id.indexOf(OCCURRENCE_SEP);
  if (idx === -1) return null;
  const masterId = id.slice(0, idx);
  const iso = id.slice(idx + OCCURRENCE_SEP.length);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { masterId, originalStartAt: d };
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarsService: CalendarsService,
    private readonly expansionService: ExpansionService,
  ) {}

  async list(userId: string, query: ListEventsQuery) {
    const ownedCalendars = await this.prisma.calendar.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const ownedIds = ownedCalendars.map((c) => c.id);
    const calendarIds = query.calendarIds
      ? query.calendarIds.filter((id) => ownedIds.includes(id))
      : ownedIds;

    if (calendarIds.length === 0) return [];

    const rangeStart = new Date(query.start);
    const rangeEnd = new Date(query.end);

    // Regular (non-recurring) events in range
    const regularEvents = await this.prisma.event.findMany({
      where: {
        calendarId: { in: calendarIds },
        isCancelled: false,
        recurringEventId: null,
        recurrenceRule: null,
        startAt: { lt: rangeEnd },
        endAt: { gt: rangeStart },
      },
      include: EVENT_INCLUDE,
      orderBy: { startAt: 'asc' },
    });

    // Master (recurring) events whose series starts before rangeEnd
    const masterEvents = await this.prisma.event.findMany({
      where: {
        calendarId: { in: calendarIds },
        isCancelled: false,
        recurringEventId: null,
        recurrenceRule: { not: null },
        startAt: { lt: rangeEnd },
      },
      include: EVENT_INCLUDE,
    });

    if (masterEvents.length === 0) return regularEvents;

    const masterIds = masterEvents.map((m) => m.id);

    const exceptions = await this.prisma.event.findMany({
      where: { recurringEventId: { in: masterIds } },
      include: EVENT_INCLUDE,
    });

    const overrides = exceptions.filter((e) => !e.isCancelled);
    const cancellations = exceptions.filter((e) => e.isCancelled);

    const occurrences = this.expansionService.expandMasterEvents(
      masterEvents,
      overrides,
      cancellations,
      rangeStart,
      rangeEnd,
    );

    const all = [...regularEvents, ...occurrences];
    return all.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }

  async findOne(id: string, userId: string) {
    // Handle occurrence ID
    const parsed = parseId(id);
    const realId = parsed ? parsed.masterId : id;

    const event = await this.prisma.event.findUnique({
      where: { id: realId },
      include: { ...EVENT_INCLUDE, attendees: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    await this.calendarsService.findOne(event.calendarId, userId);
    return event;
  }

  async create(userId: string, dto: CreateEventDto) {
    await this.calendarsService.findOne(dto.calendarId, userId);

    if (dto.recurrenceRule) validateRrule(dto.recurrenceRule);

    return this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        timezone: dto.timezone ?? 'Asia/Taipei',
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        isAllDay: dto.isAllDay ?? false,
        status: dto.status ?? 'CONFIRMED',
        privacy: dto.privacy ?? 'DEFAULT',
        color: dto.color,
        calendarId: dto.calendarId,
        ownerId: userId,
        recurrenceRule: dto.recurrenceRule ?? null,
      },
      include: EVENT_INCLUDE,
    });
  }

  async update(id: string, userId: string, dto: UpdateEventDto, scope: RecurrenceScope = 'ALL') {
    const parsed = parseId(id);
    const masterId = parsed ? parsed.masterId : id;
    const originalStartAt = parsed?.originalStartAt;

    const master = await this.prisma.event.findUnique({ where: { id: masterId } });
    if (!master) throw new NotFoundException('Event not found');
    await this.calendarsService.findOne(master.calendarId, userId);
    if (master.ownerId !== userId) throw new ForbiddenException('Only the event owner can edit it');

    if (dto.recurrenceRule) validateRrule(dto.recurrenceRule);

    const isRecurring = !!master.recurrenceRule || !!master.recurringEventId;

    // Updating the master row directly: non-recurring events, edits aimed at the
    // master itself, or an explicit ALL scope on an occurrence.
    if (!isRecurring || !originalStartAt || scope === 'ALL') {
      if (dto.calendarId && dto.calendarId !== master.calendarId) {
        await this.calendarsService.findOne(dto.calendarId, userId);
      }
      return this.prisma.event.update({
        where: { id: masterId },
        data: this.buildUpdateData(dto),
        include: EVENT_INCLUDE,
      });
    }

    if (scope === 'THIS_ONLY') {
      // Create an override row
      return this.prisma.event.create({
        data: {
          title: dto.title ?? master.title,
          description: dto.description !== undefined ? dto.description : master.description,
          location: dto.location !== undefined ? dto.location : master.location,
          timezone: dto.timezone ?? master.timezone,
          startAt: dto.startAt ? new Date(dto.startAt) : originalStartAt,
          endAt: dto.endAt
            ? new Date(dto.endAt)
            : new Date(originalStartAt.getTime() + (new Date(master.endAt).getTime() - new Date(master.startAt).getTime())),
          isAllDay: dto.isAllDay ?? master.isAllDay,
          status: dto.status ?? master.status,
          privacy: dto.privacy ?? master.privacy,
          color: dto.color !== undefined ? dto.color : master.color,
          calendarId: dto.calendarId ?? master.calendarId,
          ownerId: userId,
          recurringEventId: masterId,
          originalStartAt,
          recurrenceRule: null,
        },
        include: EVENT_INCLUDE,
      });
    }

    // THIS_AND_FOLLOWING: truncate master, create new master
    const truncatedRule = this.truncateRrule(master.recurrenceRule!, master.startAt, master.timezone, originalStartAt);
    await this.prisma.event.update({
      where: { id: masterId },
      data: { recurrenceRule: truncatedRule },
    });

    const newStart = dto.startAt ? new Date(dto.startAt) : originalStartAt;
    const masterDuration = new Date(master.endAt).getTime() - new Date(master.startAt).getTime();
    const newEnd = dto.endAt ? new Date(dto.endAt) : new Date(originalStartAt.getTime() + masterDuration);

    return this.prisma.event.create({
      data: {
        title: dto.title ?? master.title,
        description: dto.description !== undefined ? dto.description : master.description,
        location: dto.location !== undefined ? dto.location : master.location,
        timezone: dto.timezone ?? master.timezone,
        startAt: newStart,
        endAt: newEnd,
        isAllDay: dto.isAllDay ?? master.isAllDay,
        status: dto.status ?? master.status,
        privacy: dto.privacy ?? master.privacy,
        color: dto.color !== undefined ? dto.color : master.color,
        calendarId: dto.calendarId ?? master.calendarId,
        ownerId: userId,
        recurrenceRule: master.recurrenceRule,
        recurringEventId: null,
        originalStartAt: null,
      },
      include: EVENT_INCLUDE,
    });
  }

  async remove(id: string, userId: string, scope: RecurrenceScope = 'ALL') {
    const parsed = parseId(id);
    const masterId = parsed ? parsed.masterId : id;
    const originalStartAt = parsed?.originalStartAt;

    const master = await this.prisma.event.findUnique({ where: { id: masterId } });
    if (!master) throw new NotFoundException('Event not found');
    await this.calendarsService.findOne(master.calendarId, userId);
    if (master.ownerId !== userId) throw new ForbiddenException('Only the event owner can delete it');

    const isRecurring = !!master.recurrenceRule || !!master.recurringEventId;

    // Delete master + all overrides/cancellations: non-recurring events, ALL scope,
    // or a delete aimed at the master row itself.
    if (!isRecurring || scope === 'ALL' || !originalStartAt) {
      await this.prisma.event.deleteMany({ where: { recurringEventId: masterId } });
      await this.prisma.event.delete({ where: { id: masterId } });
      return;
    }

    if (scope === 'THIS_ONLY') {
      // Create a cancellation row
      await this.prisma.event.create({
        data: {
          title: master.title,
          timezone: master.timezone,
          startAt: originalStartAt,
          endAt: new Date(originalStartAt.getTime() + (new Date(master.endAt).getTime() - new Date(master.startAt).getTime())),
          calendarId: master.calendarId,
          ownerId: userId,
          recurringEventId: masterId,
          originalStartAt,
          isCancelled: true,
          recurrenceRule: null,
        },
      });
      return;
    }

    // THIS_AND_FOLLOWING: truncate master
    const truncatedRule = this.truncateRrule(master.recurrenceRule!, master.startAt, master.timezone, originalStartAt);
    // Also delete any overrides/cancellations at or after originalStartAt
    await this.prisma.event.deleteMany({
      where: {
        recurringEventId: masterId,
        originalStartAt: { gte: originalStartAt },
      },
    });
    await this.prisma.event.update({
      where: { id: masterId },
      data: { recurrenceRule: truncatedRule },
    });
  }

  private buildUpdateData(dto: UpdateEventDto) {
    return {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.location !== undefined && { location: dto.location }),
      ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      ...(dto.startAt !== undefined && { startAt: new Date(dto.startAt) }),
      ...(dto.endAt !== undefined && { endAt: new Date(dto.endAt) }),
      ...(dto.isAllDay !== undefined && { isAllDay: dto.isAllDay }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.privacy !== undefined && { privacy: dto.privacy }),
      ...(dto.color !== undefined && { color: dto.color }),
      ...(dto.calendarId !== undefined && { calendarId: dto.calendarId }),
      ...(dto.recurrenceRule !== undefined && { recurrenceRule: dto.recurrenceRule }),
    };
  }

  /** Add UNTIL to a recurrence rule so it stops just before `cutAt`. */
  private truncateRrule(rruleStr: string, masterStartAt: Date, timezone: string, cutAt: Date): string {
    const dtstart = this.expansionService.toFloating(new Date(masterStartAt), timezone);
    const rule = new RRule({ ...RRule.parseString(rruleStr), dtstart });
    const options = { ...rule.origOptions };
    // UNTIL = just before the cutAt occurrence (as floating)
    const floatingCut = this.expansionService.toFloating(cutAt, timezone);
    options.until = new Date(floatingCut.getTime() - 1000);
    delete (options as Record<string, unknown>).count;
    return this.expansionService.buildRruleString(options);
  }
}
