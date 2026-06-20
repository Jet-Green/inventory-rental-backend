import { IsBoolean } from "class-validator";

export class SetVisibilityDto {
  /** true — скрыть (active→hidden), false — показать (hidden→active). */
  @IsBoolean()
  hidden: boolean;
}
