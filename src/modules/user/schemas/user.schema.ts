import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserStatus = "person" | "ip" | "ooo";
export type UserRole = "renter" | "lessor" | "admin";
export type LessorVerificationStatus =
  | "not_requested"
  | "pending"
  | "approved"
  | "rejected";

@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true, enum: ["person", "ip", "ooo"], default: "person" })
  status: UserStatus;

  @Prop()
  inn?: string;

  @Prop()
  ogrnOrOgrnip?: string;

  @Prop()
  companyName?: string;

  @Prop()
  payoutPhone?: string;

  @Prop()
  address?: string;

  @Prop()
  passport?: string;

  @Prop({ default: false })
  isLessorVerified: boolean;

  @Prop({
    required: true,
    enum: ["not_requested", "pending", "approved", "rejected"],
    default: "not_requested",
  })
  lessorVerificationStatus: LessorVerificationStatus;

  @Prop()
  lessorVerificationComment?: string;

  @Prop({ default: false })
  isRenterVerified: boolean;

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({
    type: [String],
    enum: ["renter", "lessor", "admin"],
    default: ["renter"],
  })
  roles: UserRole[];
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
