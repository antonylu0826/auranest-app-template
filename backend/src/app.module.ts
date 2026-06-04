import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CalendarsModule } from './calendars/calendars.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { MetaModule } from './meta/meta.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, UsersModule, MetaModule, CalendarsModule, EventsModule],
})
export class AppModule {}
