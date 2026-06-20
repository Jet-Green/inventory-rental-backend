import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
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
      .sort({ order: 1, name: 1 })
      .exec();
    if (current.length) return current;
    await this.seedDefaults();
    return this.categoryModel
      .find({ isVisible: true })
      .sort({ order: 1, name: 1 })
      .exec();
  }

  async getAll(): Promise<CategoryDocument[]> {
    return this.categoryModel.find({}).sort({ order: 1, name: 1 }).exec();
  }

  /** Обновление полей категории (название/icon/order/visible). */
  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Категория не найдена");
    }
    const updated = await this.categoryModel
      .findByIdAndUpdate(id, { $set: dto }, { returnDocument: "after" })
      .exec();
    if (!updated) throw new NotFoundException("Категория не найдена");
    return updated;
  }

  /** Удаление категории. */
  async remove(id: string): Promise<{ deleted: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Категория не найдена");
    }
    const res = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException("Категория не найдена");
    return { deleted: true };
  }

  /** Переключение видимости категории. */
  async toggleVisibility(
    id: string,
    isVisible?: boolean,
  ): Promise<CategoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Категория не найдена");
    }
    const category = await this.categoryModel.findById(id).exec();
    if (!category) throw new NotFoundException("Категория не найдена");
    category.isVisible =
      typeof isVisible === "boolean" ? isVisible : !category.isVisible;
    await category.save();
    return category;
  }

  async seedDefaults(): Promise<CategoryDocument[]> {
    const defaults = [
      { key: "sport", name: "Спорт", order: 0 },
      { key: "kids", name: "Детям", order: 1 },
      { key: "ovz", name: "Для ОВЗ", order: 2 },
      { key: "hiking", name: "В поход", order: 3 },
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
