import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

/** `lessor` — только в старых документах БД, в коде используем `business`. */
export type UserRole = "renter" | "business" | "admin" | "lessor";

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

  /** Без жёсткого enum в Mongo — допускаем миграцию со старым значением `lessor`. */
  @Prop({ type: [String], default: ["renter"] })
  roles: UserRole[];
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.set("toJSON", {
  transform(_doc, ret) {
    const plain = ret as unknown as Record<string, unknown>;
    for (const k of [
      "isLessorVerified",
      "lessorVerificationStatus",
      "lessorVerificationComment",
      "status",
      "inn",
      "ogrnOrOgrnip",
      "companyName",
      "payoutPhone",
    ]) {
      delete plain[k];
    }
    return ret;
  },
});
