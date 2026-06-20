import { IsIn } from "class-validator";

export class UpdateBookingStatusDto {
  @IsIn(["pending", "confirmed", "active", "completed", "cancelled"])
  status: "pending" | "confirmed" | "active" | "completed" | "cancelled";
}
