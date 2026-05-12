import "./load-env";
import "reflect-metadata";

import * as path from "path";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";
import { env } from "./config/env";
import { PrismaService } from "./common/prisma/prisma.service";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
  });

  app.setGlobalPrefix("api");
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const uploadDir = path.resolve(env().UPLOAD_DIR);
  app.useStaticAssets(uploadDir, { prefix: "/uploads" });

  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  await app.listen(env().PORT);
}

bootstrap();
