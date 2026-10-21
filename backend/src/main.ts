import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { Env } from "./config/env";

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);
  const origin = config.get("CORS_ORIGIN", { infer: true });
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.enableCors({ origin: origin === "*" ? true : origin.split(",") });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const config = app.get(ConfigService<Env, true>);
  await app.listen(config.get("PORT", { infer: true }));
}

if (require.main === module) {
  void bootstrap();
}
