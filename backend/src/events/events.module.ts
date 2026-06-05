import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { CalendarsModule } from '../calendars/calendars.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { ExpansionService } from './expansion.service';

@Module({
  imports: [CalendarsModule, ApiKeysModule],
  controllers: [EventsController],
  providers: [EventsService, ExpansionService],
})
export class EventsModule {}
