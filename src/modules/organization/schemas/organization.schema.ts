import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type OrganizationLegalStatus = "person" | "ip" | "ooo";
export type OrganizationModerationStatus = "pending" | "approved" | "rejected";

@Schema({ timestamps: true, collection: "organizations" })
export class Organization {
  @Prop({ required: true, enum: ["person", "ip", "ooo"] })
  legalStatus: OrganizationLegalStatus;

  @Prop()
  inn?: string;

  @Prop()
  ogrnOrOgrnip?: string;

  @Prop()
  companyName?: string;

  @Prop()
  payoutPhone?: string;

  @Prop({
    required: true,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  })
  moderationStatus: OrganizationModerationStatus;

  @Prop()
  moderatorComment?: string;

  /** Пользователи, управляющие организацией (пока один менеджер). */
  @Prop({
    type: [{ type: Types.ObjectId, ref: "User" }],
    required: true,
    default: [],
  })
  orgManagers: Types.ObjectId[];
}

export type OrganizationDocument = HydratedDocument<Organization>;
export const OrganizationSchema = SchemaFactory.createForClass(Organization);
