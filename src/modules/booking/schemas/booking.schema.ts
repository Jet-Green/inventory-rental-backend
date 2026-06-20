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

  @Prop({
    required: true,
    enum: ["pending", "confirmed", "active", "completed", "cancelled"],
    default: "pending",
  })
  status: "pending" | "confirmed" | "active" | "completed" | "cancelled";

  /** Кол-во суток аренды (снимок на момент создания). */
  @Prop({ required: true, default: 1 })
  days: number;

  /** Цена за единицу в сутки (снимок цены листинга на момент брони). */
  @Prop({ required: true, default: 0 })
  pricePerDay: number;

  /** Итоговая сумма: pricePerDay * days * units. */
  @Prop({ required: true, default: 0 })
  totalPrice: number;

  /** Агентская комиссия (резерв под эквайринг, по умолчанию 0). */
  @Prop({ required: true, default: 0 })
  agentCommission: number;

  // URL договоров проставляются после генерации PDF (сразу после создания брони),
  // поэтому при создании допустима пустая строка — не required.
  @Prop({ required: false, default: "" })
  rentalAgreementPdfUrl: string;

  @Prop({ required: false, default: "" })
  agencyAgreementPdfUrl: string;
}

export type BookingDocument = HydratedDocument<Booking>;
export const BookingSchema = SchemaFactory.createForClass(Booking);
