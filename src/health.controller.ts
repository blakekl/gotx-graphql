import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { DatabaseService } from './database/database.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(@Res() reply: FastifyReply) {
    const ready = await this.database.ready();
    return reply
      .code(ready ? 200 : 503)
      .send({ status: ready ? 'ok' : 'unavailable' });
  }
}
