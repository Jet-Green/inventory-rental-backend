import { IsBoolean, IsOptional } from "class-validator";

/** Если isVisible не передан — видимость инвертируется. */
export class ToggleVisibilityDto {
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
