import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { RentalListingModule } from "../rental-listing/rental-listing.module";
import { BookingController } from "./booking.controller";
import { BookingService } from "./booking.service";
import { Booking, BookingSchema } from "./schemas/booking.schema";

@Module({
  imports: [
    AuthModule,
    RentalListingModule,
    MongooseModule.forFeature([
      {
        name: Booking.name,
        schema: BookingSchema,
      },
    ]),
  ],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
