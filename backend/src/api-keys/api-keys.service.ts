import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService } from '../meta/meta.service';
import { paginate, PaginatedResult, PaginationQuery, toPrismaOrderBy, toPrismaPage } from '../common/pagination';
import { CreateApiKeyDto, CreateApiKeyResponse, UpdateApiKeyDto } from './dto/api-key.dto';
import { ApiKey } from '@prisma/client';

const KEY_PREFIX = 'an_live_';
const PREFIX_DISPLAY_LENGTH = 16;
const ALLOWED_SORT_FIELDS = ['name', 'createdAt', 'lastUsedAt', 'expiresAt'] as const;

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaService: MetaService,
  ) {}

  async create(dto: CreateApiKeyDto, createdBy?: string): Promise<CreateApiKeyResponse> {
    this.validateScopes(dto.scopes);

    const raw = KEY_PREFIX + randomBytes(16).toString('hex');
    const hashedKey = createHash('sha256').update(raw).digest('hex');
    const prefix = raw.slice(0, KEY_PREFIX.length + PREFIX_DISPLAY_LENGTH);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        prefix,
        hashedKey,
        role: dto.role,
        scopes: dto.scopes,
        rateLimit: dto.rateLimit ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdBy: createdBy ?? null,
      },
    });

    return {
      id: apiKey.id,
      key: raw,
      prefix: apiKey.prefix,
      name: apiKey.name,
      role: apiKey.role,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
    };
  }

  async findAll(query: PaginationQuery): Promise<PaginatedResult<Omit<ApiKey, 'hashedKey'>>> {
    const where = query.search
      ? { name: { contains: query.search, mode: 'insensitive' as const } }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.apiKey.findMany({
        where,
        ...toPrismaPage(query),
        orderBy: toPrismaOrderBy(query, ALLOWED_SORT_FIELDS),
        select: {
          id: true,
          name: true,
          prefix: true,
          role: true,
          scopes: true,
          rateLimit: true,
          isActive: true,
          expiresAt: true,
          createdBy: true,
          lastUsedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.apiKey.count({ where }),
    ]);

    return paginate(data, total);
  }

  async findOne(id: string): Promise<Omit<ApiKey, 'hashedKey'>> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        prefix: true,
        role: true,
        scopes: true,
        rateLimit: true,
        isActive: true,
        expiresAt: true,
        createdBy: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!apiKey) throw new NotFoundException(`ApiKey ${id} not found`);
    return apiKey;
  }

  async update(id: string, dto: UpdateApiKeyDto): Promise<Omit<ApiKey, 'hashedKey'>> {
    await this.findOne(id);
    if (dto.scopes) this.validateScopes(dto.scopes);

    return this.prisma.apiKey.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.scopes !== undefined && { scopes: dto.scopes }),
        ...(dto.rateLimit !== undefined && { rateLimit: dto.rateLimit }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }),
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        role: true,
        scopes: true,
        rateLimit: true,
        isActive: true,
        expiresAt: true,
        createdBy: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.apiKey.delete({ where: { id } });
  }

  private validateScopes(scopes: string[]): void {
    if (scopes.includes('*')) return;

    const valid = new Set(this.metaService.getAvailableScopes());
    const invalid = scopes.filter((s) => {
      if (s === '*') return false;
      const [, action] = s.split(':');
      if (action === '*') {
        // x:* is valid if x:read exists in the valid set
        return !valid.has(s.replace(':*', ':read'));
      }
      return !valid.has(s);
    });

    if (invalid.length > 0) {
      throw new BadRequestException(`Invalid scopes: ${invalid.join(', ')}`);
    }
  }
}
