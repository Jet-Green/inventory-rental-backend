import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  CatalogFiltersDto,
  CatalogRequestDto,
} from "./dto/catalog.dto";
import { CreateListingDto } from "./dto/create-listing.dto";
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

    const [data, total] = await Promise.all([
      this.rentalListingModel.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
      this.rentalListingModel.countDocuments(query),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string): Promise<RentalListingDocument | null> {
    return this.rentalListingModel.findById(id).exec();
  }

  async create(ownerId: string, payload: CreateListingDto): Promise<RentalListingDocument> {
    return this.rentalListingModel.create({
      ...payload,
      unitsAvailable: payload.unitsTotal,
      calendar: (payload.calendar || []).map((row) => ({
        from: row.from,
        to: row.to,
        isBooked: false,
      })),
      ownerId: new Types.ObjectId(ownerId),
      moderationStatus: "pending",
    });
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
    return this.rentalListingModel
      .findByIdAndUpdate(
        payload.listingId,
        { $set: { moderationStatus: payload.status } },
        { new: true },
      )
      .exec();
  }

  async applyBooking(listingId: string, units: number): Promise<void> {
    if (!Types.ObjectId.isValid(listingId)) return;
    await this.rentalListingModel
      .findByIdAndUpdate(listingId, { $inc: { unitsAvailable: -units } })
      .exec();
  }

  async getAllForAdmin(limit = 100): Promise<RentalListingDocument[]> {
    return this.rentalListingModel.find({}).sort({ createdAt: -1 }).limit(limit).exec();
  }
}
