import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CategoryController } from "./category.controller";
import { CategoriesPublicController } from "./categories.public.controller";
import { CategoryService } from "./category.service";
import { Category, CategorySchema } from "./schemas/category.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Category.name,
        schema: CategorySchema,
      },
    ]),
  ],
  controllers: [CategoryController, CategoriesPublicController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
