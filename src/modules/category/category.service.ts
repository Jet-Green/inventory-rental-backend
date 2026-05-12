import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { Category, CategoryDocument } from "./schemas/category.schema";

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    return this.categoryModel.create(dto);
  }

  async getVisible(): Promise<CategoryDocument[]> {
    const current = await this.categoryModel
      .find({ isVisible: true })
      .sort({ name: 1 })
      .exec();
    if (current.length) return current;
    await this.seedDefaults();
    return this.categoryModel.find({ isVisible: true }).sort({ name: 1 }).exec();
  }

  async getAll(): Promise<CategoryDocument[]> {
    return this.categoryModel.find({}).sort({ name: 1 }).exec();
  }

  async seedDefaults(): Promise<CategoryDocument[]> {
    const defaults = [
      { key: "sport", name: "Спорт" },
      { key: "kids", name: "Детям" },
      { key: "ovz", name: "Для ОВЗ" },
      { key: "hiking", name: "В поход" },
    ];

    for (const item of defaults) {
      await this.categoryModel.updateOne(
        { key: item.key },
        { $setOnInsert: { ...item, isVisible: true } },
        { upsert: true },
      );
    }
    return this.getAll();
  }
}
