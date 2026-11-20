import { IsString, Matches } from "class-validator";
export class HandoffStartDto {
  @IsString() @Matches(/^[a-f0-9]{24}$/) listingId: string;
}
export class HandoffCompleteDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) code: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) state: string;
}
