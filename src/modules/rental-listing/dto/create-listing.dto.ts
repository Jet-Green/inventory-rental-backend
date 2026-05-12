import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

class AvailabilityDto {
  @IsString()
  from: string;

  @IsString()
  to: string;
}

export class CreateListingDto {
  @IsString()
  @MaxLength(140)
  title: string;

  @IsString()
  @MaxLength(3000)
  description: string;

  @IsArray()
  @IsString({ each: true })
  categories: string[];

  @IsArray()
  @IsString({ each: true })
  photos: string[];

  @IsNumber()
  @Min(1)
  pricePerDay: number;

  @IsNumber()
  @Min(1)
  minDays: number;

  @IsNumber()
  @Min(1)
  unitsTotal: number;

  @IsIn(["pickup", "delivery", "both"])
  pickupType: "pickup" | "delivery" | "both";

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @IsOptional()
  @IsString()
  deliveryZone?: string;

  @IsOptional()
  @IsArray()
  calendar?: AvailabilityDto[];
}
