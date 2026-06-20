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

/** Частичное обновление объявления владельцем. Все поля опциональны. */
export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  pricePerDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  unitsTotal?: number;

  @IsOptional()
  @IsIn(["pickup", "delivery", "both"])
  pickupType?: "pickup" | "delivery" | "both";

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
