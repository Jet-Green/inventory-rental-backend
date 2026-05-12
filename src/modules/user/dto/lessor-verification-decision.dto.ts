import { IsOptional, IsString } from "class-validator";

export class LessorVerificationDecisionDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
