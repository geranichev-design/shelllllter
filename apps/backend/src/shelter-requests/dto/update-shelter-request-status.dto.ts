import { ShelterRequestStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateShelterRequestStatusDto {
  @IsEnum(ShelterRequestStatus)
  status!: ShelterRequestStatus;

  @ValidateIf((dto) => dto.status === ShelterRequestStatus.REJECTED)
  @IsString()
  @IsNotEmpty()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
