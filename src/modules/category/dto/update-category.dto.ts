import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

/** Частичное обновление категории (админ). */
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
