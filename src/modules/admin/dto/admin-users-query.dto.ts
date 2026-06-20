import { IsIn, IsOptional } from "class-validator";

export class AdminUsersQueryDto {
  /** Фильтр по роли. */
  @IsOptional()
  @IsIn(["renter", "business", "admin"])
  role?: "renter" | "business" | "admin";

  /** Фильтр по статусу верификации (organization.moderationStatus). */
  @IsOptional()
  @IsIn(["pending", "approved", "rejected", "none"])
  verification?: "pending" | "approved" | "rejected" | "none";
}
