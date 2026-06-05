import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CalendarColor, CalendarType } from '@prisma/client';

export class CreateCalendarDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(CalendarType)
  @IsOptional()
  type?: CalendarType;

  @IsEnum(CalendarColor)
  @IsOptional()
  color?: CalendarColor;
}

export class UpdateCalendarDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(CalendarColor)
  @IsOptional()
  color?: CalendarColor;

  @IsOptional()
  isVisible?: boolean;
}
