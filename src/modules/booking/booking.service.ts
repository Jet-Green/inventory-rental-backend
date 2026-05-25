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
    const requestedFromTs = Date.parse(dto.dateFrom);
    const requestedToTs = Date.parse(dto.dateTo);
    if (Number.isNaN(requestedFromTs) || Number.isNaN(requestedToTs) || requestedToTs <= requestedFromTs) {
      throw new BadRequestException("Некорректный период бронирования");
    }

    const activeBookings = await this.bookingModel
      .find({
        listingId: new Types.ObjectId(dto.listingId),
        status: { $in: ["pending", "confirmed"] },
      })
      .select({ dateFrom: 1, dateTo: 1, units: 1 })
      .exec();

    const reservedUnits = activeBookings.reduce((sum, booking) => {
      const bookingFromTs = Date.parse(booking.dateFrom);
      const bookingToTs = Date.parse(booking.dateTo);
      if (Number.isNaN(bookingFromTs) || Number.isNaN(bookingToTs)) return sum;
      const overlaps = bookingFromTs < requestedToTs && bookingToTs > requestedFromTs;
      return overlaps ? sum + booking.units : sum;
    }, 0);

    const periodUnitsAvailable = Math.max(0, listing.unitsTotal - reservedUnits);
    if (periodUnitsAvailable < dto.units) {
      throw new BadRequestException(
        periodUnitsAvailable > 0
          ? `На выбранный период доступно только ${periodUnitsAvailable} ед.`
          : "На выбранный период нет доступных единиц",
      );
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

  async getBusyRangesByListingId(listingId: string): Promise<
    Array<{
      bookingId: string;
      dateFrom: string;
      dateTo: string;
      status: "pending" | "confirmed";
      units: number;
    }>
  > {
    if (!Types.ObjectId.isValid(listingId)) return [];

    const bookings = await this.bookingModel
      .find({
        listingId: new Types.ObjectId(listingId),
        status: { $in: ["pending", "confirmed"] },
      })
      .select({ dateFrom: 1, dateTo: 1, status: 1, units: 1 })
      .sort({ dateFrom: 1 })
      .exec();

    return bookings.map((booking) => ({
      bookingId: booking._id.toString(),
      dateFrom: booking.dateFrom,
      dateTo: booking.dateTo,
      status: booking.status,
      units: booking.units,
    }));
  }
}
