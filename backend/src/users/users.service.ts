import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, toPrismaOrderBy, toPrismaPage, type PaginationQuery } from '../common/pagination';
import { UpdateRoleDto, UpdateUserDto } from './dto/user.dto';

const SORTABLE = ['name', 'email', 'createdAt'] as const;

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  name: true,
  roleId: true,
  role: { select: { id: true, name: true, displayName: true, permissionPolicy: true } },
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveDefaultRoleId(): Promise<string> {
    const userRole = await this.prisma.role.findUnique({ where: { name: 'USER' } });
    if (!userRole) throw new Error('USER system role not found — run the seed first');
    return userRole.id;
  }

  async create(data: { email: string; password: string; name?: string; roleId?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already registered');
    const roleId = data.roleId ?? (await this.resolveDefaultRoleId());
    return this.prisma.user.create({ data: { ...data, roleId }, select: PUBLIC_FIELDS });
  }

  // Includes role + permissions for JWT signing in auth.controller
  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: { include: { permissions: true } } },
    });
  }

  async findAll(query: PaginationQuery) {
    const { skip, take } = toPrismaPage(query);
    const orderBy = toPrismaOrderBy(query, SORTABLE, { createdAt: 'asc' });
    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take, orderBy, select: PUBLIC_FIELDS }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(data, total);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: PUBLIC_FIELDS });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);
    return this.prisma.user.update({ where: { id }, data: dto, select: PUBLIC_FIELDS });
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    await this.findById(id);
    return this.prisma.user.update({ where: { id }, data: { roleId: dto.roleId }, select: PUBLIC_FIELDS });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.user.delete({ where: { id } });
  }
}
