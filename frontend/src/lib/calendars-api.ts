import { apiFetch } from './api';

export type CalendarColor = 'BLUE' | 'GREEN' | 'RED' | 'YELLOW' | 'PURPLE' | 'PINK' | 'TEAL' | 'GRAY';
export type CalendarType = 'PERSONAL' | 'SHARED';

export const COLOR_HEX: Record<CalendarColor, string> = {
  BLUE: '#3b82f6',
  GREEN: '#22c55e',
  RED: '#ef4444',
  YELLOW: '#eab308',
  PURPLE: '#a855f7',
  PINK: '#ec4899',
  TEAL: '#14b8a6',
  GRAY: '#6b7280',
};

export const ALL_COLORS: CalendarColor[] = ['BLUE', 'GREEN', 'RED', 'YELLOW', 'PURPLE', 'PINK', 'TEAL', 'GRAY'];

export interface Calendar {
  id: string;
  name: string;
  description: string | null;
  type: CalendarType;
  color: CalendarColor;
  isVisible: boolean;
  isPrimary: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCalendarInput {
  name: string;
  description?: string;
  color?: CalendarColor;
}

export interface UpdateCalendarInput {
  name?: string;
  description?: string;
  color?: CalendarColor;
  isVisible?: boolean;
}

export const calendarsApi = {
  list: () => apiFetch<Calendar[]>('/calendars'),
  get: (id: string) => apiFetch<Calendar>(`/calendars/${id}`),
  create: (data: CreateCalendarInput) =>
    apiFetch<Calendar>('/calendars', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateCalendarInput) =>
    apiFetch<Calendar>(`/calendars/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => apiFetch<void>(`/calendars/${id}`, { method: 'DELETE' }),
};
