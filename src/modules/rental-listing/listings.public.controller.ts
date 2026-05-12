import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { RentalListingService } from "./rental-listing.service";

type ListingCardDto = {
  id: string;
  title: string;
  description: string;
  photo?: string;
  pricePerDay: number;
  minRentalDays: number;
  availableUnits: number;
  pickupMethods: Array<"self_pickup" | "delivery">;
  pickupAddress?: string;
  deliveryZone?: string;
  categorySlugs: string[];
  status: "active" | "moderation" | "rejected" | "hidden" | "draft";
};

function toPickupMethods(
  pickupType: "pickup" | "delivery" | "both",
): Array<"self_pickup" | "delivery"> {
  if (pickupType === "pickup") return ["self_pickup"];
  if (pickupType === "delivery") return ["delivery"];
  return ["self_pickup", "delivery"];
}

function toPublicStatus(
  moderationStatus: "active" | "pending" | "rejected" | "hidden",
): ListingCardDto["status"] {
  if (moderationStatus === "pending") return "moderation";
  return moderationStatus;
}

@Controller("listings")
export class ListingsPublicController {
  constructor(private readonly rentalListingService: RentalListingService) {}

  @Get()
  async list(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("categorySlugs") categorySlugs?: string | string[],
    @Query("priceFrom") priceFrom?: string,
    @Query("priceTo") priceTo?: string,
    @Query("pickupMethod") pickupMethod?: "self_pickup" | "delivery",
    @Query("unitsNeeded") unitsNeeded?: string,
  ) {
    const categories =
      categorySlugs === undefined
        ? undefined
        : Array.isArray(categorySlugs)
          ? categorySlugs
          : String(categorySlugs)
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);

    const pickupType =
      pickupMethod === "self_pickup" ? "pickup" : pickupMethod === "delivery" ? "delivery" : undefined;

    const result = await this.rentalListingService.getCatalog({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      filters: {
        search: search || undefined,
        categories,
        priceFrom: priceFrom ? Number(priceFrom) : undefined,
        priceTo: priceTo ? Number(priceTo) : undefined,
        pickupType,
        unitsNeeded: unitsNeeded ? Number(unitsNeeded) : undefined,
      },
    });

    const data: ListingCardDto[] = result.data.map((doc) => ({
      id: doc._id.toString(),
      title: doc.title,
      description: doc.description,
      photo: doc.photos?.[0],
      pricePerDay: doc.pricePerDay,
      minRentalDays: doc.minDays,
      availableUnits: doc.unitsAvailable,
      pickupMethods: toPickupMethods(doc.pickupType),
      pickupAddress: doc.pickupAddress,
      deliveryZone: doc.deliveryZone,
      categorySlugs: doc.categories || [],
      status: toPublicStatus(doc.moderationStatus),
    }));

    return {
      data,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
    };
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    const doc = await this.rentalListingService.getById(id);
    if (!doc) throw new NotFoundException("Объявление не найдено");

    const listing: ListingCardDto = {
      id: doc._id.toString(),
      title: doc.title,
      description: doc.description,
      photo: doc.photos?.[0],
      pricePerDay: doc.pricePerDay,
      minRentalDays: doc.minDays,
      availableUnits: doc.unitsAvailable,
      pickupMethods: toPickupMethods(doc.pickupType),
      pickupAddress: doc.pickupAddress,
      deliveryZone: doc.deliveryZone,
      categorySlugs: doc.categories || [],
      status: toPublicStatus(doc.moderationStatus),
    };

    return { listing };
  }
}

