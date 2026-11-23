import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min
} from 'class-validator';
import { AccessType, AccountingStatus, RecordStatus, ShelterStatus, ShelterType } from '@prisma/client';

export class CreateShelterRequestDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(ShelterType)
  type!: ShelterType;

  @IsEnum(AccessType)
  accessType!: AccessType;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  capacity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ownerOrgId?: string;

  @IsOptional()
  @IsEnum(ShelterStatus)
  shelterStatus?: ShelterStatus;

  @IsOptional()
  @IsEnum(AccountingStatus)
  accountingStatus?: AccountingStatus;

  @IsOptional()
  @IsEnum(RecordStatus)
  recordStatus?: RecordStatus;

  @IsOptional()
  @IsString()
  shelterStatusDate?: string;

  @IsOptional()
  @IsString()
  accountingStatusDate?: string;

  @IsOptional()
  @IsString()
  recordStatusDate?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  responsible?: string;

  @Allow()
  accountNumber?: string;

  @Allow()
  tempNumber?: string;

  @Allow()
  technicalNumber?: string;

  @Allow()
  registrationDate?: string;

  @Allow()
  region?: string;

  @Allow()
  country?: string;

  @Allow()
  district?: string;

  @Allow()
  community?: string;

  @Allow()
  settlement?: string;

  @Allow()
  settlementType?: string;

  @Allow()
  streetType?: string;

  @Allow()
  streetName?: string;

  @Allow()
  building?: string;

  @Allow()
  corpus?: string;

  @Allow()
  apartment?: string;

  @Allow()
  postalCode?: string;

  @Allow()
  katottg?: string;

  @Allow()
  latEntrance?: number;

  @Allow()
  lonEntrance?: number;

  @Allow()
  latCenter?: number;

  @Allow()
  lonCenter?: number;

  @Allow()
  walkRadius?: number;

  @Allow()
  relativeLocation?: string;

  @Allow()
  areaDescription?: string;

  @Allow()
  dangerZones?: string;

  @Allow()
  alwaysReady?: boolean;

  @Allow()
  readinessTime?: number;

  @Allow()
  populationCategories?: string;

  @Allow()
  area?: number;

  @Allow()
  volume?: number;

  @Allow()
  accessibleForDisabled?: boolean;

  @Allow()
  barrierFreeAccess?: boolean;

  @Allow()
  shelterClass?: string;

  @Allow()
  floorsCount?: number;

  @Allow()
  entrancesCount?: number;

  @Allow()
  emergencyExitsCount?: number;

  @Allow()
  ownershipForm?: string;

  @Allow()
  departmentalAffiliation?: string;

  @Allow()
  governmentBody?: string;

  @Allow()
  institution?: string;

  @Allow()
  balanceHolder?: string;

  @Allow()
  operationalManagementForm?: string;

  @Allow()
  operationStartDate?: string;

  @Allow()
  orgName?: string;

  @Allow()
  orgEdrpou?: string;

  @Allow()
  orgAddress?: string;

  @Allow()
  orgActivity?: string;

  @Allow()
  contactLastName?: string;

  @Allow()
  contactFirstName?: string;

  @Allow()
  contactMiddleName?: string;

  @Allow()
  contactPosition?: string;

  @Allow()
  contactPhone?: string;

  @Allow()
  contactEmail?: string;

  @Allow()
  contactIsCurrent?: boolean;

  @Allow()
  managerLastName?: string;

  @Allow()
  managerFirstName?: string;

  @Allow()
  managerMiddleName?: string;

  @Allow()
  managerPosition?: string;

  @Allow()
  ownerName?: string;

  @Allow()
  ownerEdrpou?: string;

  @Allow()
  ownerAddress?: string;

  @Allow()
  ownerActivity?: string;

  @Allow()
  buildingRegistryNumber?: string;

  @Allow()
  buildingInventoryDate?: string;

  @Allow()
  btiName?: string;

  @Allow()
  purposeCode?: string;

  @Allow()
  purposeName?: string;

  @Allow()
  peacetimePurpose?: string;

  @Allow()
  designerName?: string;

  @Allow()
  designerEdrpou?: string;

  @Allow()
  designDocLink?: string;

  @Allow()
  contractorName?: string;

  @Allow()
  contractorEdrpou?: string;

  @Allow()
  isGeneralContractor?: boolean;

  @Allow()
  doorType?: string;

  @Allow()
  doorMark?: string;

  @Allow()
  doorCount?: number;

  @Allow()
  ventilationSystem?: string;

  @Allow()
  fanType?: string;

  @Allow()
  fanCapacity?: string;

  @Allow()
  fanCount?: number;

  @Allow()
  filterType?: string;

  @Allow()
  filterCount?: number;

  @Allow()
  valveType?: string;

  @Allow()
  valveCapacity?: string;

  @Allow()
  valveCount?: number;

  @Allow()
  antiBlastType?: string;

  @Allow()
  antiBlastCount?: number;

  @Allow()
  pumpType?: string;

  @Allow()
  pumpCapacity?: string;

  @Allow()
  pumpCount?: number;

  @Allow()
  heaterType?: string;

  @Allow()
  heaterCapacity?: string;

  @Allow()
  heaterCount?: number;

  @Allow()
  coolingType?: string;

  @Allow()
  coolingCapacity?: string;

  @Allow()
  coolingCount?: number;

  @Allow()
  measuringType?: string;

  @Allow()
  measuringCount?: number;

  @Allow()
  sealingDegree?: string;

  @Allow()
  mainPowerSource?: string;

  @Allow()
  powerReliabilityCategory?: string;

  @Allow()
  lighting?: string;

  @Allow()
  backupPower?: string;

  @Allow()
  engineeringPower?: string;

  @Allow()
  powerProtection?: string;

  @Allow()
  hasWaterSupply?: boolean;

  @Allow()
  waterSource?: string;

  @Allow()
  waterPurpose?: string;

  @Allow()
  waterReserveLocation?: string;

  @Allow()
  waterCapacityLiters?: number;

  @Allow()
  sewageSystemType?: string;

  @Allow()
  sewageSystemKind?: string;

  @Allow()
  heatingClass?: string;

  @Allow()
  heatingSubclass?: string;

  @Allow()
  heatingType?: string;

  @Allow()
  communicationMeans?: string;

  @Allow()
  hasRadioPoint?: boolean;

  @Allow()
  otherPropertyType?: string;

  @Allow()
  otherPropertyName?: string;

  @Allow()
  otherPropertyCount?: number;

  @Allow()
  lastInspectionDate?: string;

  @Allow()
  inspector?: string;

  @Allow()
  inspectionResult?: string;

  @Allow()
  nextInspectionDate?: string;

  @Allow()
  violations?: string;

  @Allow()
  inspectorComments?: string;

  @Allow()
  technicalPassportNumber?: string;

  @Allow()
  technicalPassportDate?: string;

  @Allow()
  acceptanceActNumber?: string;

  @Allow()
  acceptanceActDate?: string;

  @Allow()
  operationPermitNumber?: string;

  @Allow()
  operationPermitDate?: string;

  @Allow()
  insurancePolicyNumber?: string;

  @Allow()
  insurancePolicyDate?: string;

  @Allow()
  documentNotes?: string;

  @Allow()
  balanceValue?: number;

  @Allow()
  annualMaintenanceCost?: number;

  @Allow()
  fundingSource?: string;

  @Allow()
  budgetCode?: string;

  @Allow()
  lastValuationDate?: string;

  @IsOptional()
  @IsArray()
  media?: unknown[];
}
