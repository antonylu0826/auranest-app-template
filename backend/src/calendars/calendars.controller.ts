import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { CurrentUser, type JwtPayload } from '../auth/decorators/current-user.decorator';
import { CalendarsService } from './calendars.service';
import { CreateCalendarDto, UpdateCalendarDto } from './dto/calendar.dto';

@Controller('calendars')
@UseGuards(JwtOrApiKeyGuard)
export class CalendarsController {
  constructor(private readonly calendarsService: CalendarsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.calendarsService.findAllForUser(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.calendarsService.findOne(id, user.sub);
  }

  @Post()
  create(@Body() dto: CreateCalendarDto, @CurrentUser() user: JwtPayload) {
    return this.calendarsService.create(user.sub, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCalendarDto, @CurrentUser() user: JwtPayload) {
    return this.calendarsService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.calendarsService.remove(id, user.sub);
  }
}
