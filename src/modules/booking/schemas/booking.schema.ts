import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

@Schema({ timestamps: true, collection: "bookings" })
export class Booking {
  @Prop({ required: true, type: Types.ObjectId, ref: "RentalListing", autopopulate: true })
  listingId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: "User", autopopulate: true })
  renterId: Types.ObjectId;

  @Prop({ required: true })
  dateFrom: string;

  @Prop({ required: true })
  dateTo: string;

  @Prop({ required: true })
  units: number;

  @Prop({ required: true, enum: ["pending", "confirmed", "cancelled"], default: "pending" })
  status: "pending" | "confirmed" | "cancelled";

  @Prop({ required: true })
  rentalAgreementPdfUrl: string;

  @Prop({ required: true })
  agencyAgreementPdfUrl: string;
}

export type BookingDocument = HydratedDocument<Booking>;
export const BookingSchema = SchemaFactory.createForClass(Booking);
