import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

class AvailabilityRange {
  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  to: string;

  @Prop({ required: true, default: false })
  isBooked: boolean;
}

@Schema({ timestamps: true, collection: "rental_listings" })
export class RentalListing {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, type: [String], default: [] })
  categories: string[];

  @Prop({ required: true, type: [String], default: [] })
  photos: string[];

  @Prop({ required: true })
  pricePerDay: number;

  @Prop({ required: true })
  minDays: number;

  @Prop({ required: true })
  unitsTotal: number;

  @Prop({ required: true })
  unitsAvailable: number;

  @Prop({ required: true, enum: ["pickup", "delivery", "both"] })
  pickupType: "pickup" | "delivery" | "both";

  @Prop()
  pickupAddress?: string;

  @Prop()
  deliveryZone?: string;

  @Prop({ type: [AvailabilityRange], default: [] })
  calendar: AvailabilityRange[];

  @Prop({
    required: true,
    enum: ["active", "pending", "rejected", "hidden"],
    default: "pending",
  })
  moderationStatus: "active" | "pending" | "rejected" | "hidden";

  @Prop({ required: true, type: Types.ObjectId, ref: "User", autopopulate: true })
  ownerId: Types.ObjectId;
}

export type RentalListingDocument = HydratedDocument<RentalListing>;
export const RentalListingSchema = SchemaFactory.createForClass(RentalListing);
