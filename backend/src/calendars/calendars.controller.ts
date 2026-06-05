import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser, type JwtPayload } from '../auth/decorators/current-user.decorator';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { CalendarsService } from './calendars.service';
import { CreateCalendarDto, UpdateCalendarDto } from './dto/calendar.dto';

@Controller('calendars')
@UseGuards(JwtOrApiKeyGuard, PermissionGuard)
export class CalendarsController {
  constructor(private readonly calendarsService: CalendarsService) {}

  @Get()
  @RequirePermissions(Permission.CALENDAR_READ)
  findAll(@CurrentUser() user: JwtPayload) {
    return this.calendarsService.findAllForUser(user.sub);
  }

  @Get(':id')
  @RequirePermissions(Permission.CALENDAR_READ)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.calendarsService.findOne(id, user.sub);
  }

  @Post()
  @RequirePermissions(Permission.CALENDAR_CREATE)
  create(@Body() dto: CreateCalendarDto, @CurrentUser() user: JwtPayload) {
    return this.calendarsService.create(user.sub, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CALENDAR_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateCalendarDto, @CurrentUser() user: JwtPayload) {
    return this.calendarsService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(Permission.CALENDAR_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.calendarsService.remove(id, user.sub);
  }
}
