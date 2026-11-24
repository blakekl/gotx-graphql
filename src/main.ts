import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { DatabaseService } from './database/database.service.js';
import {
  ConfigurationError,
  runtimeConfiguration,
} from './database/configuration.js';

async function bootstrap() {
  let app: NestFastifyApplication | undefined;
  let deadline: NodeJS.Timeout | undefined;
  try {
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { abortOnError: false, logger: false },
    );
    const { port, host, shutdownMs } = runtimeConfiguration(
      app.get(ConfigService),
    );
    const database = app.get(DatabaseService);
    const stop = () => {
      database.stopAdmission();
      deadline ??= setTimeout(() => {
        console.error('Service shutdown deadline exceeded');
        process.exit(1);
      }, shutdownMs);
      deadline.unref();
    };
    // Registered first: readiness/admission is closed before Nest starts teardown.
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    app.enableShutdownHooks(['SIGTERM', 'SIGINT']);
    app.enableCors();
    await app.listen(port, host);
    console.log('Service listening');
  } catch (error) {
    console.error(
      error instanceof ConfigurationError
        ? `Service startup failed; ${error.message}`
        : 'Service startup failed; check configuration and listener availability',
    );
    // Cleanup can itself wait on an acquired resource; bound the failure path too.
    deadline ??= setTimeout(() => process.exit(1), 5000);
    deadline.unref();
    try {
      await app?.close();
    } catch {
      /* Never expose driver/configuration errors. */
    }
    clearTimeout(deadline);
    process.exitCode = 1;
  }
}
void bootstrap();
