import { apiFetch, toQueryString } from './api';
import type { CalendarColor } from './calendars-api';

export type EventStatus = 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
export type EventPrivacy = 'DEFAULT' | 'PUBLIC' | 'PRIVATE';

export interface CalendarRef {
  id: string;
  name: string;
  color: CalendarColor;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  timezone: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  status: EventStatus;
  privacy: EventPrivacy;
  recurrenceRule: string | null;
  recurringEventId: string | null;
  isCancelled: boolean;
  color: CalendarColor | null;
  calendarId: string;
  ownerId: string;
  calendar: CalendarRef;
}

export interface CreateEventInput {
  title: string;
  calendarId: string;
  startAt: string;
  endAt: string;
  timezone?: string;
  isAllDay?: boolean;
  description?: string;
  location?: string;
  color?: CalendarColor;
}

export interface UpdateEventInput {
  title?: string;
  calendarId?: string;
  startAt?: string;
  endAt?: string;
  timezone?: string;
  isAllDay?: boolean;
  description?: string;
  location?: string;
  color?: CalendarColor | null;
}

export interface ListEventsQuery {
  start: string;
  end: string;
  calendarIds?: string;
}

export type RecurrenceScope = 'THIS_ONLY' | 'THIS_AND_FOLLOWING' | 'ALL';

export function isRecurringEvent(event: CalendarEvent): boolean {
  return !!event.recurrenceRule || !!event.recurringEventId || event.id.includes('__');
}

export const eventsApi = {
  list: (query: ListEventsQuery) =>
    apiFetch<CalendarEvent[]>(`/events${toQueryString({ ...query })}`),
  get: (id: string) => apiFetch<CalendarEvent>(`/events/${id}`),
  create: (data: CreateEventInput) =>
    apiFetch<CalendarEvent>('/events', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateEventInput, scope: RecurrenceScope = 'ALL') =>
    apiFetch<CalendarEvent>(`/events/${id}?scope=${scope}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string, scope: RecurrenceScope = 'ALL') =>
    apiFetch<void>(`/events/${id}?scope=${scope}`, { method: 'DELETE' }),
};
