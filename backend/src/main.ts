import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const origins = configService
    .get<string>('ALLOWED_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix('api');

  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('CodeBase Q&A API')
      .setDescription('Multi-hop RAG over AST-chunked GitHub repos')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
    Logger.log(`Swagger → http://localhost:${port}/api/docs`, 'Bootstrap');
  }

  await app.listen(port);
  Logger.log(`Running on http://localhost:${port} [${nodeEnv}]`, 'Bootstrap');
}

bootstrap();
