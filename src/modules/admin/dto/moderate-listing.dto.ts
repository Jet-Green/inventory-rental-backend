import { IsOptional, IsString, MaxLength } from "class-validator";

export class ModerateListingDto {
  /** Причина отклонения (для reject). */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;
}
