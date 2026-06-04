import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MetaService, SchemaMeta } from './meta.service';

@Controller('meta')
@UseGuards(JwtOrApiKeyGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get('schema')
  schema(): SchemaMeta {
    return this.metaService.buildMeta();
  }
}
