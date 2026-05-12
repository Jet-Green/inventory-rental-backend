import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateModerationDto {
  @IsString()
  listingId: string;

  @IsIn(["active", "pending", "rejected", "hidden"])
  status: "active" | "pending" | "rejected" | "hidden";

  @IsOptional()
  @IsString()
  reason?: string;
}
