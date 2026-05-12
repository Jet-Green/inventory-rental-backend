import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { ListingsPublicController } from "./listings.public.controller";
import { RentalListingController } from "./rental-listing.controller";
import { RentalListingService } from "./rental-listing.service";
import {
  RentalListing,
  RentalListingSchema,
} from "./schemas/rental-listing.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      {
        name: RentalListing.name,
        schema: RentalListingSchema,
      },
    ]),
  ],
  controllers: [RentalListingController, ListingsPublicController],
  providers: [RentalListingService],
  exports: [RentalListingService],
})
export class RentalListingModule {}
