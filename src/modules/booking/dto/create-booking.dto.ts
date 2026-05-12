import { IsBoolean, IsDateString, IsMongoId, IsNumber, Min } from "class-validator";

export class CreateBookingDto {
  @IsMongoId()
  listingId: string;

  @IsDateString()
  dateFrom: string;

  @IsDateString()
  dateTo: string;

  @IsNumber()
  @Min(1)
  units: number;

  @IsBoolean()
  acceptedPersonalData: boolean;
}
