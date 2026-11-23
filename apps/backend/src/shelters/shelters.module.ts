import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { SheltersController } from './shelters.controller';
import { SheltersService } from './shelters.service';

@Module({
  imports: [CommonModule],
  controllers: [SheltersController],
  providers: [SheltersService]
})
export class SheltersModule {}
