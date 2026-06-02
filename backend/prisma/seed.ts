import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;
  const name = process.env.SEED_USER_NAME;

  if (!email || !password) {
    console.log('SEED_USER_EMAIL / SEED_USER_PASSWORD not set — skipping seed.');
    return;
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { role: UserRole.ADMIN },
    create: { email, password: hashed, name, role: UserRole.ADMIN },
  });

  console.log(`Seed user ready: ${email} (ADMIN)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
