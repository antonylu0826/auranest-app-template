import { BadRequestException } from '@nestjs/common';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CalendarColor, EventPrivacy, EventStatus } from '@prisma/client';
import { z } from 'zod';
import { RRule } from 'rrule';

export class CreateEventDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  calendarId: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsBoolean()
  @IsOptional()
  isAllDay?: boolean;

  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;

  @IsEnum(EventPrivacy)
  @IsOptional()
  privacy?: EventPrivacy;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  location?: string;

  @IsEnum(CalendarColor)
  @IsOptional()
  color?: CalendarColor;

  @IsString()
  @IsOptional()
  recurrenceRule?: string;
}

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  calendarId?: string;

  @IsDateString()
  @IsOptional()
  startAt?: string;

  @IsDateString()
  @IsOptional()
  endAt?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsBoolean()
  @IsOptional()
  isAllDay?: boolean;

  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;

  @IsEnum(EventPrivacy)
  @IsOptional()
  privacy?: EventPrivacy;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  location?: string;

  @IsEnum(CalendarColor)
  @IsOptional()
  color?: CalendarColor | null;

  @IsString()
  @IsOptional()
  recurrenceRule?: string | null;
}

export type RecurrenceScope = 'THIS_ONLY' | 'THIS_AND_FOLLOWING' | 'ALL';

export const listEventsQuerySchema = z.object({
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  calendarIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : undefined)),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

export const updateScopeSchema = z.object({
  scope: z.enum(['THIS_ONLY', 'THIS_AND_FOLLOWING', 'ALL']).optional().default('ALL'),
});
export type UpdateScopeQuery = z.infer<typeof updateScopeSchema>;

/** Validate that a string is a legal RRULE (throws if invalid). */
export function validateRrule(rule: string): void {
  try {
    RRule.fromString(rule);
  } catch {
    throw new BadRequestException(`Invalid RRULE: ${rule}`);
  }
}
