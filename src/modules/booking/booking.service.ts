import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { StorageService } from "../../common/storage/storage.service";
import { OrganizationService } from "../organization/organization.service";
import { RentalListingService } from "../rental-listing/rental-listing.service";
import { UserService } from "../user/user.service";
import {
  ContractData,
  ContractParty,
  ContractPdfService,
} from "./contract-pdf.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { UpdateBookingStatusDto } from "./dto/update-booking-status.dto";
import { Booking, BookingDocument } from "./schemas/booking.schema";

type BookingStatus =
  | "pending"
  | "confirmed"
  | "active"
  | "completed"
  | "cancelled";

/** Разрешённые ручные переходы статусов брони. */
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    private readonly rentalListingService: RentalListingService,
    private readonly organizationService: OrganizationService,
    private readonly storageService: StorageService,
    private readonly contractPdfService: ContractPdfService,
    private readonly userService: UserService,
  ) {}

  private getMaxReservedUnitsInRange(
    bookings: Array<{ dateFrom: string; dateTo: string; units: number }>,
    rangeFromTs: number,
    rangeToTs: number,
  ): number {
    const events: Array<{ ts: number; delta: number }> = [];

    for (const booking of bookings) {
      const bookingFromTs = Date.parse(booking.dateFrom);
      const bookingToTs = Date.parse(booking.dateTo);
      if (Number.isNaN(bookingFromTs) || Number.isNaN(bookingToTs)) continue;
      if (bookingToTs <= rangeFromTs || bookingFromTs >= rangeToTs) continue;

      const start = Math.max(rangeFromTs, bookingFromTs);
      const end = Math.min(rangeToTs, bookingToTs);
      if (end <= start) continue;
      events.push({ ts: start, delta: booking.units });
      events.push({ ts: end, delta: -booking.units });
    }

    events.sort((a, b) => (a.ts === b.ts ? a.delta - b.delta : a.ts - b.ts));

    let active = 0;
    let maxActive = 0;
    for (const event of events) {
      active += event.delta;
      if (active > maxActive) maxActive = active;
    }
    return maxActive;
  }

  /** Кол-во суток аренды (минимум 1). */
  private calcDays(fromTs: number, toTs: number): number {
    const ms = toTs - fromTs;
    return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

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
        status: { $in: ["pending", "confirmed", "active"] },
      })
      .select({ dateFrom: 1, dateTo: 1, units: 1 })
      .exec();

    const maxReservedUnits = this.getMaxReservedUnitsInRange(
      activeBookings.map((booking) => ({
        dateFrom: booking.dateFrom,
        dateTo: booking.dateTo,
        units: booking.units,
      })),
      requestedFromTs,
      requestedToTs,
    );

    const periodUnitsAvailable = Math.max(0, listing.unitsTotal - maxReservedUnits);
    if (periodUnitsAvailable < dto.units) {
      throw new BadRequestException(
        periodUnitsAvailable > 0
          ? `На выбранный период доступно только ${periodUnitsAvailable} ед.`
          : "На выбранный период нет доступных единиц",
      );
    }

    // Расчёт суммы: pricePerDay * дни * единицы.
    const days = this.calcDays(requestedFromTs, requestedToTs);
    const pricePerDay = listing.pricePerDay;
    const totalPrice = pricePerDay * days * dto.units;
    // Комиссия агента — резерв под эквайринг (процент из env, по умолчанию 0).
    const commissionPercent = Number(process.env.AGENT_COMMISSION_PERCENT || 0);
    const agentCommission = Math.round((totalPrice * commissionPercent) / 100);

    const booking = await this.bookingModel.create({
      listingId: new Types.ObjectId(dto.listingId),
      renterId: new Types.ObjectId(userId),
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      units: dto.units,
      days,
      pricePerDay,
      totalPrice,
      agentCommission,
      status: "pending",
      // Временные плейсхолдеры — заменяются реальными URL после генерации PDF.
      rentalAgreementPdfUrl: "",
      agencyAgreementPdfUrl: "",
    });

    // Генерация двух договоров и сохранение в хранилище.
    const { rentalAgreementPdfUrl, agencyAgreementPdfUrl } =
      await this.generateContracts(booking, listing, userId, {
        days,
        pricePerDay,
        totalPrice,
        agentCommission,
      });

    booking.rentalAgreementPdfUrl = rentalAgreementPdfUrl;
    booking.agencyAgreementPdfUrl = agencyAgreementPdfUrl;
    await booking.save();

    return {
      bookingId: booking._id.toString(),
      status: booking.status,
      days,
      pricePerDay,
      totalPrice,
      agentCommission,
      rentalAgreementPdfUrl,
      agencyAgreementPdfUrl,
    };
  }

  /** Генерирует 2 PDF-договора и возвращает публичные URL. */
  private async generateContracts(
    booking: BookingDocument,
    listing: any,
    renterUserId: string,
    money: { days: number; pricePerDay: number; totalPrice: number; agentCommission: number },
  ): Promise<{ rentalAgreementPdfUrl: string; agencyAgreementPdfUrl: string }> {
    const owner = listing.ownerId; // автопопулирован (User)
    const ownerOrg = owner?._id
      ? await this.organizationService.findMine(owner._id.toString())
      : null;

    const renterUser = await this.userService.getById(renterUserId);
    const renterParty: ContractParty = {
      name: renterUser?.fullName || `пользователь ${renterUserId}`,
      legalLabel: "Физическое лицо",
      address: renterUser?.address,
      phone: renterUser?.phone,
    };

    const ownerParty: ContractParty = this.buildOwnerParty(owner, ownerOrg);
    const agentParty = this.buildAgentParty();

    const contractData: ContractData = {
      bookingId: booking._id.toString(),
      renter: renterParty,
      owner: ownerParty,
      agent: agentParty,
      equipment: {
        title: listing.title,
        description: listing.description,
        units: booking.units,
        pricePerDay: money.pricePerDay,
      },
      dateFrom: booking.dateFrom,
      dateTo: booking.dateTo,
      days: money.days,
      totalPrice: money.totalPrice,
      pickupMethod: this.pickupMethodText(listing),
      issuedAt: new Date(),
    };

    try {
      const [rentalPdf, agencyPdf] = await Promise.all([
        this.contractPdfService.generateRentalAgreement(contractData),
        this.contractPdfService.generateAgencyAgreement(contractData),
      ]);

      const [rentalUploaded, agencyUploaded] = await Promise.all([
        this.storageService.upload({
          buffer: rentalPdf,
          folder: "contracts",
          originalName: `rental-${booking._id.toString()}.pdf`,
          contentType: "application/pdf",
        }),
        this.storageService.upload({
          buffer: agencyPdf,
          folder: "contracts",
          originalName: `agency-${booking._id.toString()}.pdf`,
          contentType: "application/pdf",
        }),
      ]);

      return {
        rentalAgreementPdfUrl: rentalUploaded.url,
        agencyAgreementPdfUrl: agencyUploaded.url,
      };
    } catch (err) {
      this.logger.error(
        `Ошибка генерации PDF-договоров для брони ${booking._id.toString()}: ${(err as Error).message}`,
      );
      throw new BadRequestException("Не удалось сформировать договоры");
    }
  }

  private buildOwnerParty(owner: any, org: any): ContractParty {
    const legalLabel = !org
      ? "Физическое лицо"
      : org.legalStatus === "ip"
        ? "Индивидуальный предприниматель"
        : org.legalStatus === "ooo"
          ? "Общество с ограниченной ответственностью"
          : "Физическое лицо";
    return {
      name: org?.companyName || owner?.fullName || "Арендодатель",
      legalLabel,
      inn: org?.inn,
      ogrn: org?.ogrnOrOgrnip,
      address: owner?.address,
      phone: org?.payoutPhone || owner?.phone,
    };
  }

  private buildAgentParty(): ContractParty {
    return {
      name: process.env.AGENT_NAME || "ИП Владелец платформы",
      legalLabel: "Индивидуальный предприниматель",
      inn: process.env.AGENT_INN || undefined,
      ogrn: process.env.AGENT_OGRN || undefined,
      address: process.env.AGENT_ADDRESS || undefined,
      phone: process.env.AGENT_PHONE || undefined,
    };
  }

  private pickupMethodText(listing: any): string {
    if (listing.pickupType === "delivery") {
      return `доставка${listing.deliveryZone ? ` (${listing.deliveryZone})` : ""}`;
    }
    if (listing.pickupType === "both") {
      return `самовывоз${listing.pickupAddress ? ` (${listing.pickupAddress})` : ""} или доставка`;
    }
    return `самовывоз${listing.pickupAddress ? ` (${listing.pickupAddress})` : ""}`;
  }

  async getMyBookings(userId: string): Promise<BookingDocument[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    return this.bookingModel
      .find({ renterId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /** Брони по объявлениям арендодателя (владельца). */
  async getOwnerBookings(ownerId: string): Promise<BookingDocument[]> {
    if (!Types.ObjectId.isValid(ownerId)) return [];
    const listings = await this.rentalListingService.getByOwner(ownerId);
    const listingIds = listings.map((l) => l._id);
    if (!listingIds.length) return [];
    return this.bookingModel
      .find({ listingId: { $in: listingIds } })
      .sort({ createdAt: -1 })
      .exec();
  }

  private async getBookingOrThrow(bookingId: string): Promise<BookingDocument> {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new NotFoundException("Бронь не найдена");
    }
    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking) throw new NotFoundException("Бронь не найдена");
    return booking;
  }

  /** Является ли пользователь владельцем листинга этой брони. */
  private async isListingOwner(
    booking: BookingDocument,
    userId: string,
  ): Promise<boolean> {
    const listingId =
      (booking.listingId as any)?._id?.toString?.() ??
      booking.listingId?.toString?.();
    const listing = await this.rentalListingService.getById(listingId);
    if (!listing) return false;
    const ownerIdStr =
      (listing.ownerId as any)?._id?.toString?.() ?? listing.ownerId?.toString?.();
    return ownerIdStr === userId;
  }

  private isRenter(booking: BookingDocument, userId: string): boolean {
    const renterIdStr =
      (booking.renterId as any)?._id?.toString?.() ??
      booking.renterId?.toString?.();
    return renterIdStr === userId;
  }

  /**
   * Ручная смена статуса. Правила:
   *  - cancelled: арендатор или владелец (из pending/confirmed/active);
   *  - confirmed/active/completed: только владелец листинга.
   *  - admin может всё.
   */
  async updateStatus(
    bookingId: string,
    userId: string,
    isAdmin: boolean,
    dto: UpdateBookingStatusDto,
  ): Promise<{ booking: BookingDocument }> {
    const booking = await this.getBookingOrThrow(bookingId);
    const current = booking.status as BookingStatus;
    const next = dto.status;

    if (!ALLOWED_TRANSITIONS[current].includes(next)) {
      throw new BadRequestException(
        `Недопустимый переход статуса: ${current} -> ${next}`,
      );
    }

    const isOwner = await this.isListingOwner(booking, userId);
    const isRenter = this.isRenter(booking, userId);

    if (!isAdmin) {
      if (next === "cancelled") {
        if (!isOwner && !isRenter) {
          throw new ForbiddenException("Нет прав на отмену этой брони");
        }
      } else {
        // Подтверждение/активация/завершение — только владелец.
        if (!isOwner) {
          throw new ForbiddenException(
            "Менять статус сделки может только арендодатель",
          );
        }
      }
    }

    booking.status = next;
    await booking.save();
    return { booking };
  }

  /**
   * Заглушка оплаты: переводит pending -> confirmed.
   * Реальный эквайринг (Т-банк) подключается позже.
   */
  async pay(bookingId: string, userId: string, isAdmin: boolean) {
    const booking = await this.getBookingOrThrow(bookingId);
    if (!isAdmin && !this.isRenter(booking, userId)) {
      throw new ForbiddenException("Оплатить бронь может только арендатор");
    }
    if (booking.status !== "pending") {
      throw new BadRequestException(
        "Оплата возможна только для брони со статусом pending",
      );
    }
    booking.status = "confirmed";
    await booking.save();
    return {
      bookingId: booking._id.toString(),
      status: booking.status,
      paid: true,
    };
  }

  /** Доступ к договорам: только участники сделки или админ. */
  async getContracts(bookingId: string, userId: string, isAdmin: boolean) {
    const booking = await this.getBookingOrThrow(bookingId);
    const isOwner = await this.isListingOwner(booking, userId);
    const isRenter = this.isRenter(booking, userId);
    if (!isAdmin && !isOwner && !isRenter) {
      throw new ForbiddenException("Нет доступа к договорам этой брони");
    }
    return {
      rentalAgreementPdfUrl: booking.rentalAgreementPdfUrl,
      agencyAgreementPdfUrl: booking.agencyAgreementPdfUrl,
    };
  }

  async getBusyRangesByListingId(listingId: string): Promise<
    Array<{
      bookingId: string;
      dateFrom: string;
      dateTo: string;
      status: "pending" | "confirmed" | "active";
      units: number;
    }>
  > {
    if (!Types.ObjectId.isValid(listingId)) return [];

    const bookings = await this.bookingModel
      .find({
        listingId: new Types.ObjectId(listingId),
        status: { $in: ["pending", "confirmed", "active"] },
      })
      .select({ dateFrom: 1, dateTo: 1, status: 1, units: 1 })
      .sort({ dateFrom: 1 })
      .exec();

    const result: Array<{
      bookingId: string;
      dateFrom: string;
      dateTo: string;
      status: "pending" | "confirmed" | "active";
      units: number;
    }> = [];

    for (const booking of bookings) {
      if (
        booking.status !== "pending" &&
        booking.status !== "confirmed" &&
        booking.status !== "active"
      ) {
        continue;
      }
      result.push({
        bookingId: booking._id.toString(),
        dateFrom: booking.dateFrom,
        dateTo: booking.dateTo,
        status: booking.status,
        units: booking.units,
      });
    }

    return result;
  }
}
