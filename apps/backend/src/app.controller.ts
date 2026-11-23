import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      status: 'ok',
      service: 'shelter-registry-api',
      message: 'API is running'
    };
  }

  @Get('health')
  health() {
    return {
      status: 'ok'
    };
  }
}
