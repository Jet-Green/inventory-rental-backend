import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import cookieParser from "cookie-parser";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  // Гарантируем наличие папки локального хранилища (fallback-режим).
  const uploadsDir = join(process.cwd(), "uploads");
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  const app = await NestFactory.create(AppModule);

  const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length
      ? allowedOrigins
      : ["http://localhost:3068", "https://rent.firetechno.ru"],
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix("api");

  await app.listen(process.env.PORT || 4000);
}

bootstrap();
