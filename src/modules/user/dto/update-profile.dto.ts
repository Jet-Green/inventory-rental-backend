import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  fullName?: string;

  @IsEmail()
  email?: string;

  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(["person", "ip", "ooo"])
  status?: "person" | "ip" | "ooo";

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  inn?: string;

  @IsOptional()
  @IsString()
  ogrnOrOgrnip?: string;

  @IsOptional()
  @IsString()
  payoutPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  passport?: string;
}
