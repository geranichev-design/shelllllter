import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsObject,
  IsPositive,
  IsString,
  Max,
  Min
} from 'class-validator';
import { AccessType, AccountingStatus, RecordStatus, ShelterStatus, ShelterType } from '@prisma/client';

export class UpdateShelterDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(ShelterType)
  type?: ShelterType;

  @IsOptional()
  @IsEnum(AccessType)
  accessType?: AccessType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsEnum(ShelterStatus)
  status?: ShelterStatus;

  @IsOptional()
  @IsEnum(AccountingStatus)
  accountingStatus?: AccountingStatus;

  @IsOptional()
  @IsEnum(RecordStatus)
  recordStatus?: RecordStatus;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ownerOrgId?: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}
