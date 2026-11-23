import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ShelterRequestsController } from './shelter-requests.controller';
import { ShelterRequestsService } from './shelter-requests.service';

@Module({
  imports: [CommonModule],
  controllers: [ShelterRequestsController],
  providers: [ShelterRequestsService]
})
export class ShelterRequestsModule {}
