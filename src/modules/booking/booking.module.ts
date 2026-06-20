import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { OrganizationModule } from "../organization/organization.module";
import { RentalListingModule } from "../rental-listing/rental-listing.module";
import { UserModule } from "../user/user.module";
import { BookingController } from "./booking.controller";
import { BookingService } from "./booking.service";
import { ContractPdfService } from "./contract-pdf.service";
import { Booking, BookingSchema } from "./schemas/booking.schema";

@Module({
  imports: [
    AuthModule,
    RentalListingModule,
    OrganizationModule,
    UserModule,
    MongooseModule.forFeature([
      {
        name: Booking.name,
        schema: BookingSchema,
      },
    ]),
  ],
  controllers: [BookingController],
  providers: [BookingService, ContractPdfService],
})
export class BookingModule {}
