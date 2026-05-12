import { IsIn, IsString, MinLength } from "class-validator";

export class SubmitOrganizationVerificationDto {
  @IsIn(["person", "ip", "ooo"])
  legalStatus: "person" | "ip" | "ooo";

  @IsString()
  @MinLength(1)
  inn: string;

  @IsString()
  @MinLength(1)
  ogrnOrOgrnip: string;

  @IsString()
  @MinLength(1)
  companyName: string;

  @IsString()
  @MinLength(1)
  payoutPhone: string;
}
