import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, type SortOrder, Types } from "mongoose";
import {
  CatalogFiltersDto,
  CatalogRequestDto,
} from "./dto/catalog.dto";
import {
  Booking,
  BookingDocument,
} from "../booking/schemas/booking.schema";
import { CreateListingDto } from "./dto/create-listing.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";
import { UpdateModerationDto } from "./dto/update-moderation.dto";
import {
  RentalListing,
  RentalListingDocument,
} from "./schemas/rental-listing.schema";

@Injectable()
export class RentalListingService {
  constructor(
    @InjectModel(RentalListing.name)
    private readonly rentalListingModel: Model<RentalListingDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
  ) { }

  private buildCatalogQuery(filters?: CatalogFiltersDto): Record<string, any> {
    const query: Record<string, any> = {
      moderationStatus: "active",
    };

    if (!filters) return query;
    if (filters.categories?.length) query.categories = { $in: filters.categories };
    if (filters.pickupType) query.pickupType = filters.pickupType;
    if (typeof filters.unitsNeeded === "number") {
      query.unitsAvailable = { $gte: filters.unitsNeeded };
    }
    if (typeof filters.priceFrom === "number" || typeof filters.priceTo === "number") {
      query.pricePerDay = {};
      if (typeof filters.priceFrom === "number") query.pricePerDay.$gte = filters.priceFrom;
      if (typeof filters.priceTo === "number") query.pricePerDay.$lte = filters.priceTo;
    }
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } },
      ];
    }

    return query;
  }

  async getCatalog(payload: CatalogRequestDto) {
    const page = Math.max(1, Number(payload.page) || 1);
    const limit = Math.min(48, Math.max(1, Number(payload.limit) || 12));
    const skip = (page - 1) * limit;
    const query = this.buildCatalogQuery(payload.filters);
    const sort: Record<string, SortOrder> =
      payload.filters?.sortBy === "priceAsc"
        ? { pricePerDay: 1 as SortOrder, createdAt: -1 as SortOrder }
        : payload.filters?.sortBy === "priceDesc"
          ? { pricePerDay: -1 as SortOrder, createdAt: -1 as SortOrder }
          : { createdAt: -1 as SortOrder };

    const dateFrom = payload.filters?.dateFrom;
    const dateTo = payload.filters?.dateTo;
    const hasDateFilter = this.isValidRange(dateFrom, dateTo);

    // Без фильтра по датам — обычная пагинация на уровне БД.
    if (!hasDateFilter) {
      const [data, total] = await Promise.all([
        this.rentalListingModel.find(query).skip(skip).limit(limit).sort(sort).exec(),
        this.rentalListingModel.countDocuments(query),
      ]);
      return { data, total, page, totalPages: Math.ceil(total / limit) };
    }

    // С фильтром по датам: исключаем листинги без свободных единиц в диапазоне.
    // Требуется сверка с занятостью (units), поэтому фильтруем в памяти,
    // затем пагинируем отфильтрованный набор.
    const unitsNeeded =
      typeof payload.filters?.unitsNeeded === "number"
        ? payload.filters.unitsNeeded
        : 1;
    const candidates = await this.rentalListingModel.find(query).sort(sort).exec();
    const available = await this.filterByDateAvailability(
      candidates,
      dateFrom as string,
      dateTo as string,
      unitsNeeded,
    );

    const total = available.length;
    const data = available.slice(skip, skip + limit);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  private isValidRange(from?: string, to?: string): boolean {
    if (!from || !to) return false;
    const fromTs = Date.parse(from);
    const toTs = Date.parse(to);
    return !Number.isNaN(fromTs) && !Number.isNaN(toTs) && toTs > fromTs;
  }

  /**
   * Оставляет только листинги, у которых в диапазоне [from; to)
   * свободно не менее `unitsNeeded` единиц с учётом активных броней.
   */
  private async filterByDateAvailability(
    listings: RentalListingDocument[],
    from: string,
    to: string,
    unitsNeeded: number,
  ): Promise<RentalListingDocument[]> {
    if (!listings.length) return [];
    const rangeFromTs = Date.parse(from);
    const rangeToTs = Date.parse(to);

    const ids = listings.map((l) => l._id);
    const bookings = await this.bookingModel
      .find({
        listingId: { $in: ids },
        status: { $in: ["pending", "confirmed", "active"] },
      })
      .select({ listingId: 1, dateFrom: 1, dateTo: 1, units: 1 })
      .exec();

    // Группируем брони по листингу.
    const byListing = new Map<
      string,
      Array<{ dateFrom: string; dateTo: string; units: number }>
    >();
    for (const b of bookings) {
      const key = b.listingId.toString();
      if (!byListing.has(key)) byListing.set(key, []);
      byListing.get(key)!.push({
        dateFrom: b.dateFrom,
        dateTo: b.dateTo,
        units: b.units,
      });
    }

    return listings.filter((listing) => {
      const listingBookings = byListing.get(listing._id.toString()) || [];
      const reserved = this.maxReservedUnitsInRange(
        listingBookings,
        rangeFromTs,
        rangeToTs,
      );
      const free = Math.max(0, listing.unitsTotal - reserved);
      return free >= unitsNeeded;
    });
  }

  /** Максимум одновременно занятых единиц в диапазоне (sweep-line). */
  private maxReservedUnitsInRange(
    bookings: Array<{ dateFrom: string; dateTo: string; units: number }>,
    rangeFromTs: number,
    rangeToTs: number,
  ): number {
    const events: Array<{ ts: number; delta: number }> = [];
    for (const booking of bookings) {
      const bFrom = Date.parse(booking.dateFrom);
      const bTo = Date.parse(booking.dateTo);
      if (Number.isNaN(bFrom) || Number.isNaN(bTo)) continue;
      if (bTo <= rangeFromTs || bFrom >= rangeToTs) continue;
      const start = Math.max(rangeFromTs, bFrom);
      const end = Math.min(rangeToTs, bTo);
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

  async getById(id: string): Promise<RentalListingDocument | null> {
    return this.rentalListingModel.findById(id).exec();
  }

  async create(ownerId: string, payload: CreateListingDto): Promise<RentalListingDocument> {
    // asDraft=true сохраняет объявление черновиком (без отправки на модерацию).
    const { asDraft, ...rest } = payload;
    return this.rentalListingModel.create({
      ...rest,
      unitsAvailable: payload.unitsTotal,
      calendar: (payload.calendar || []).map((row) => ({
        from: row.from,
        to: row.to,
        isBooked: false,
      })),
      ownerId: new Types.ObjectId(ownerId),
      moderationStatus: asDraft ? "draft" : "pending",
    });
  }

  /** Перевод черновика на модерацию (draft -> pending). Только владелец. */
  async submitForModeration(
    listingId: string,
    ownerId: string,
  ): Promise<RentalListingDocument> {
    const listing = await this.findOwnedOrThrow(listingId, ownerId);
    if (listing.moderationStatus !== "draft" && listing.moderationStatus !== "rejected") {
      throw new ForbiddenException(
        "Отправить на модерацию можно только черновик или отклонённое объявление",
      );
    }
    listing.moderationStatus = "pending";
    listing.rejectionReason = undefined;
    await listing.save();
    return listing;
  }

  /**
   * Редактирование объявления владельцем. Применяет переданные поля.
   * Изменённое активное/одобренное объявление возвращается на модерацию.
   */
  async updateOwned(
    listingId: string,
    ownerId: string,
    payload: UpdateListingDto,
  ): Promise<RentalListingDocument> {
    const listing = await this.findOwnedOrThrow(listingId, ownerId);

    const scalarFields = [
      "title",
      "description",
      "categories",
      "photos",
      "pricePerDay",
      "minDays",
      "pickupType",
      "pickupAddress",
      "deliveryZone",
    ] as const;
    for (const field of scalarFields) {
      if (payload[field] !== undefined) {
        (listing as any)[field] = payload[field];
      }
    }

    // unitsAvailable — зеркало unitsTotal (реальная занятость считается из броней).
    if (payload.unitsTotal !== undefined) {
      listing.unitsTotal = payload.unitsTotal;
      listing.unitsAvailable = payload.unitsTotal;
    }

    if (payload.calendar !== undefined) {
      listing.calendar = payload.calendar.map((row) => ({
        from: row.from,
        to: row.to,
        isBooked: false,
      })) as any;
    }

    // Правка опубликованного/скрытого объявления требует повторной модерации.
    if (listing.moderationStatus === "active" || listing.moderationStatus === "hidden") {
      listing.moderationStatus = "pending";
      listing.rejectionReason = undefined;
    }

    await listing.save();
    return listing;
  }

  /**
   * Скрыть/показать объявление владельцем.
   * Скрыть: active -> hidden. Показать: hidden -> active.
   */
  async setVisibilityOwned(
    listingId: string,
    ownerId: string,
    hidden: boolean,
  ): Promise<RentalListingDocument> {
    const listing = await this.findOwnedOrThrow(listingId, ownerId);
    if (hidden) {
      if (listing.moderationStatus !== "active") {
        throw new ForbiddenException("Скрыть можно только опубликованное объявление");
      }
      listing.moderationStatus = "hidden";
    } else {
      if (listing.moderationStatus !== "hidden") {
        throw new ForbiddenException("Показать можно только скрытое объявление");
      }
      listing.moderationStatus = "active";
    }
    await listing.save();
    return listing;
  }

  /** Удаление объявления владельцем. */
  async removeOwned(
    listingId: string,
    ownerId: string,
  ): Promise<{ deleted: boolean }> {
    await this.findOwnedOrThrow(listingId, ownerId);
    await this.rentalListingModel.findByIdAndDelete(listingId).exec();
    return { deleted: true };
  }

  /** Удаление объявления администратором. */
  async removeByAdmin(listingId: string): Promise<{ deleted: boolean }> {
    if (!Types.ObjectId.isValid(listingId)) {
      throw new NotFoundException("Объявление не найдено");
    }
    const res = await this.rentalListingModel.findByIdAndDelete(listingId).exec();
    if (!res) throw new NotFoundException("Объявление не найдено");
    return { deleted: true };
  }

  private async findOwnedOrThrow(
    listingId: string,
    ownerId: string,
  ): Promise<RentalListingDocument> {
    if (!Types.ObjectId.isValid(listingId)) {
      throw new NotFoundException("Объявление не найдено");
    }
    const listing = await this.rentalListingModel.findById(listingId).exec();
    if (!listing) throw new NotFoundException("Объявление не найдено");
    // ownerId автопопулируется — приводим к строке через _id.
    const ownerIdStr =
      (listing.ownerId as any)?._id?.toString?.() ?? listing.ownerId?.toString?.();
    if (ownerIdStr !== ownerId) {
      throw new ForbiddenException("Нет прав на это объявление");
    }
    return listing;
  }

  async getByOwner(ownerId: string): Promise<RentalListingDocument[]> {
    if (!Types.ObjectId.isValid(ownerId)) return [];
    return this.rentalListingModel
      .find({ ownerId: new Types.ObjectId(ownerId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateModeration(payload: UpdateModerationDto): Promise<RentalListingDocument | null> {
    if (!Types.ObjectId.isValid(payload.listingId)) return null;
    const set: Record<string, any> = { moderationStatus: payload.status };
    if (payload.status === "rejected") {
      // Сохраняем причину отклонения (reason или rejectionReason).
      set.rejectionReason =
        payload.rejectionReason || payload.reason || "Без указания причины";
    } else {
      set.rejectionReason = undefined;
    }
    return this.rentalListingModel
      .findByIdAndUpdate(
        payload.listingId,
        payload.status === "rejected"
          ? { $set: { moderationStatus: payload.status, rejectionReason: set.rejectionReason } }
          : { $set: { moderationStatus: payload.status }, $unset: { rejectionReason: "" } },
        { returnDocument: "after" },
      )
      .exec();
  }

  async getAllForAdmin(limit = 100): Promise<RentalListingDocument[]> {
    return this.rentalListingModel.find({}).sort({ createdAt: -1 }).limit(limit).exec();
  }
}
