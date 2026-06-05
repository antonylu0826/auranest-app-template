import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Permission } from '@prisma/client';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
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
@UseGuards(JwtOrApiKeyGuard, PermissionGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @RequirePermissions(Permission.EVENT_READ)
  list(
    @Query(new ZodValidationPipe(listEventsQuerySchema)) query: ListEventsQuery,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eventsService.list(user.sub, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.EVENT_READ)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.eventsService.findOne(id, user.sub);
  }

  @Post()
  @RequirePermissions(Permission.EVENT_CREATE)
  create(@Body() dto: CreateEventDto, @CurrentUser() user: JwtPayload) {
    return this.eventsService.create(user.sub, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EVENT_UPDATE)
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
  @RequirePermissions(Permission.EVENT_DELETE)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(updateScopeSchema)) scopeQuery: UpdateScopeQuery,
  ) {
    return this.eventsService.remove(id, user.sub, scopeQuery.scope);
  }
}
