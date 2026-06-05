import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { SYSTEM_ADMIN_ROLE, SYSTEM_USER_ROLE } from '../src/auth/constants';

const prisma = new PrismaClient();

// Template has no business module permissions.
// Fork-specific permissions should be added here after forking.
const USER_DEFAULT_PERMISSIONS: never[] = [];

async function main() {
  // Step 1: Upsert system roles (always runs, independent of seed user env vars)
  const adminRole = await prisma.role.upsert({
    where: { name: SYSTEM_ADMIN_ROLE },
    update: { displayName: 'Administrator', isSystem: true },
    create: { name: SYSTEM_ADMIN_ROLE, displayName: 'Administrator', isSystem: true, permissionPolicy: 'DENY_ALL' },
  });

  const userRole = await prisma.role.upsert({
    where: { name: SYSTEM_USER_ROLE },
    update: { displayName: 'User', isSystem: true },
    create: { name: SYSTEM_USER_ROLE, displayName: 'User', isSystem: true, permissionPolicy: 'DENY_ALL' },
  });

  // Idempotent: replace USER role permissions
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: userRole.id } }),
    ...(USER_DEFAULT_PERMISSIONS.length > 0
      ? [prisma.rolePermission.createMany({
          data: USER_DEFAULT_PERMISSIONS.map((p) => ({ roleId: userRole.id, permission: p })),
        })]
      : []),
  ]);
  console.log('System roles ready (ADMIN, USER)');

  // Step 2: Seed ADMIN user (optional — requires env vars)
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;
  const name = process.env.SEED_USER_NAME;

  if (!email || !password) {
    console.log('SEED_USER_EMAIL / SEED_USER_PASSWORD not set — skipping user seed.');
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { roleId: adminRole.id },
    create: { email, password: hashed, name, roleId: adminRole.id },
  });

  console.log(`Seed user ready: ${email} (ADMIN)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
