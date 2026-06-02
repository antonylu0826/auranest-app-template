import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import pinoHttp from 'pino-http';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(pinoHttp({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' }));

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? '*',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend running on :${port} [AUTH_MODE=${process.env.AUTH_MODE ?? 'local'}]`);
}

bootstrap();
