import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserRole = "renter" | "business" | "admin";

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

  @Prop()
  address?: string;

  @Prop()
  passport?: string;

  @Prop({ default: false })
  isRenterVerified: boolean;

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({
    type: [String],
    enum: ["renter", "business", "admin"],
    default: ["renter"],
  })
  roles: UserRole[];
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
