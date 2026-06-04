import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CalendarColor, CalendarType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCalendarDto, UpdateCalendarDto } from './dto/calendar.dto';

@Injectable()
export class CalendarsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lazy-create the primary personal calendar for a user on first access. */
  async ensurePrimaryCalendar(userId: string) {
    const existing = await this.prisma.calendar.findFirst({ where: { ownerId: userId, isPrimary: true } });
    if (!existing) {
      await this.prisma.calendar.create({
        data: {
          name: '個人',
          type: CalendarType.PERSONAL,
          color: CalendarColor.BLUE,
          isPrimary: true,
          isVisible: true,
          ownerId: userId,
        },
      });
    }
  }

  async findAllForUser(userId: string) {
    await this.ensurePrimaryCalendar(userId);
    return this.prisma.calendar.findMany({
      where: { ownerId: userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string, userId: string) {
    const calendar = await this.prisma.calendar.findUnique({ where: { id } });
    if (!calendar) throw new NotFoundException('Calendar not found');
    if (calendar.ownerId !== userId) throw new ForbiddenException('Access denied');
    return calendar;
  }

  async create(userId: string, dto: CreateCalendarDto) {
    return this.prisma.calendar.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type ?? CalendarType.PERSONAL,
        color: dto.color ?? CalendarColor.BLUE,
        isPrimary: false,
        isVisible: true,
        ownerId: userId,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateCalendarDto) {
    await this.findOne(id, userId);
    return this.prisma.calendar.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    const calendar = await this.findOne(id, userId);
    if (calendar.isPrimary) throw new ForbiddenException('Cannot delete the primary calendar');
    await this.prisma.calendar.delete({ where: { id } });
  }
}
