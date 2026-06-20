import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({ timestamps: true, collection: "categories" })
export class Category {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: true })
  isVisible: boolean;

  /** Идентификатор/URL иконки категории (опционально). */
  @Prop()
  icon?: string;

  /** Порядок сортировки в каталоге (меньше — выше). */
  @Prop({ default: 0 })
  order: number;
}

export type CategoryDocument = HydratedDocument<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);
