import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  key: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
