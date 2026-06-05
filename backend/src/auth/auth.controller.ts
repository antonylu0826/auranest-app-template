import { Body, Controller, ForbiddenException, Get, Post, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Permission } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt.guard';

function buildTokenPayload(user: {
  id: string;
  email: string;
  name?: string | null;
  role: { name: string; permissionPolicy: string; permissions: { permission: Permission }[] };
}) {
  return {
    sub: user.id,
    email: user.email,
    name: user.name,
    roleName: user.role.name,
    permissionPolicy: user.role.permissionPolicy,
    permissions: user.role.permissions.map((p) => p.permission),
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const hashed = await bcrypt.hash(dto.password, 12);
    await this.usersService.create({ email: dto.email, password: hashed, name: dto.name });
    // Reload with role+permissions for JWT signing
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Registration failed');
    const payload = buildTokenPayload(user);
    const token = this.jwtService.sign(payload);
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, roleName: payload.roleName },
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) throw new ForbiddenException('Account is disabled');
    const payload = buildTokenPayload(user);
    const token = this.jwtService.sign(payload);
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, roleName: payload.roleName },
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() req: { user: { sub: string; email: string; roleName: string } }) {
    return req.user;
  }
}
