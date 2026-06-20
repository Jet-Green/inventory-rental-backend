import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateModerationDto {
  @IsString()
  listingId: string;

  @IsIn(["draft", "active", "pending", "rejected", "hidden"])
  status: "draft" | "active" | "pending" | "rejected" | "hidden";

  /** Причина отклонения (при status=rejected). */
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  /** Алиас причины (для обратной совместимости). */
  @IsOptional()
  @IsString()
  reason?: string;
}
