import { IsBoolean } from "class-validator";

export class SetBlockedDto {
  @IsBoolean()
  isBlocked: boolean;
}
