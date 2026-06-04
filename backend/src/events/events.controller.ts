import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { CurrentUser, type JwtPayload } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { EventsService } from './events.service';
import {
  CreateEventDto,
  UpdateEventDto,
  listEventsQuerySchema,
  updateScopeSchema,
  type ListEventsQuery,
  type UpdateScopeQuery,
} from './dto/event.dto';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listEventsQuerySchema)) query: ListEventsQuery,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eventsService.list(user.sub, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.eventsService.findOne(id, user.sub);
  }

  @Post()
  create(@Body() dto: CreateEventDto, @CurrentUser() user: JwtPayload) {
    return this.eventsService.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(updateScopeSchema)) scopeQuery: UpdateScopeQuery,
  ) {
    return this.eventsService.update(id, user.sub, dto, scopeQuery.scope);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(updateScopeSchema)) scopeQuery: UpdateScopeQuery,
  ) {
    return this.eventsService.remove(id, user.sub, scopeQuery.scope);
  }
}
