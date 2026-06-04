import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { ExpansionService } from './expansion.service';
import { CalendarsModule } from '../calendars/calendars.module';

@Module({
  imports: [CalendarsModule],
  controllers: [EventsController],
  providers: [EventsService, ExpansionService],
})
export class EventsModule {}
