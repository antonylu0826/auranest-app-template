import { Controller, Get, UseGuards } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface FieldMeta {
  name: string;
  type: string;
  kind: string;
  isRequired: boolean;
  isUnique: boolean;
  isId: boolean;
  isList: boolean;
  hasDefault: boolean;
  default?: unknown;
  documentation?: string;
  relationName?: string;
}

interface ModelMeta {
  name: string;
  dbTable: string;
  documentation?: string;
  fields: FieldMeta[];
}

interface EnumValueMeta {
  name: string;
  documentation?: string;
}

interface EnumMeta {
  name: string;
  documentation?: string;
  values: EnumValueMeta[];
}

interface SchemaMeta {
  generatedAt: string;
  models: ModelMeta[];
  enums: EnumMeta[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDMMF = any;

function buildMeta(): SchemaMeta {
  const { models, enums } = Prisma.dmmf.datamodel as AnyDMMF;

  return {
    generatedAt: new Date().toISOString(),
    models: models.map((m: AnyDMMF) => ({
      name: m.name,
      dbTable: m.dbName ?? m.name.toLowerCase(),
      documentation: m.documentation,
      fields: m.fields
        .filter((f: AnyDMMF) => f.kind !== 'object')
        .map((f: AnyDMMF) => ({
          name: f.name,
          type: f.type,
          kind: f.kind,
          isRequired: f.isRequired,
          isUnique: f.isUnique,
          isId: f.isId,
          isList: f.isList,
          hasDefault: f.hasDefaultValue,
          default: f.default,
          documentation: f.documentation,
        })),
    })),
    enums: enums.map((e: AnyDMMF) => ({
      name: e.name,
      documentation: e.documentation,
      values: e.values.map((v: AnyDMMF) => ({
        name: v.name,
        documentation: v.documentation,
      })),
    })),
  };
}

@Controller('meta')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class MetaController {
  @Get('schema')
  schema(): SchemaMeta {
    return buildMeta();
  }
}
