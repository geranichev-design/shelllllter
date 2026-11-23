import { IsEnum, IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export enum ReviewDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT'
}

export class ReviewShelterRequestDto {
  @IsEnum(ReviewDecision)
  decision!: ReviewDecision;

  @ValidateIf((dto) => dto.decision === ReviewDecision.REJECT)
  @IsString()
  @IsNotEmpty()
  rejectionReason?: string;
}
