import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { RentalListingService } from "../rental-listing/rental-listing.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { Booking, BookingDocument } from "./schemas/booking.schema";

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    private readonly rentalListingService: RentalListingService,
  ) {}

  async create(userId: string, dto: CreateBookingDto) {
    if (!dto.acceptedPersonalData) {
      throw new BadRequestException("Нужно согласие на обработку персональных данных");
    }

    const listing = await this.rentalListingService.getById(dto.listingId);
    if (!listing) throw new BadRequestException("Объявление не найдено");
    if (listing.unitsAvailable < dto.units) {
      throw new BadRequestException("Недостаточно доступных единиц");
    }

    const booking = await this.bookingModel.create({
      listingId: new Types.ObjectId(dto.listingId),
      renterId: new Types.ObjectId(userId),
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      units: dto.units,
      status: "pending",
      rentalAgreementPdfUrl: `https://storage.example.com/contracts/rental-${Date.now()}.pdf`,
      agencyAgreementPdfUrl: `https://storage.example.com/contracts/agency-${Date.now()}.pdf`,
    });

    await this.rentalListingService.applyBooking(dto.listingId, dto.units);

    return {
      bookingId: booking._id.toString(),
      rentalAgreementPdfUrl: booking.rentalAgreementPdfUrl,
      agencyAgreementPdfUrl: booking.agencyAgreementPdfUrl,
      status: booking.status,
    };
  }

  async getMyBookings(userId: string): Promise<BookingDocument[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    return this.bookingModel
      .find({ renterId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }
}
