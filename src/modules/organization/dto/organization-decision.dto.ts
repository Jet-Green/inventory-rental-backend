import { IsOptional, IsString } from "class-validator";

export class OrganizationDecisionDto {
  @IsString()
  organizationId: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
