import { Body, Controller, Get, Post } from "@nestjs/common";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CategoryService } from "./category.service";

@Controller("category")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get("visible")
  async getVisible() {
    return { categories: await this.categoryService.getVisible() };
  }

  @Get("all")
  async getAll() {
    return { categories: await this.categoryService.getAll() };
  }

  @Post("create")
  async create(@Body() dto: CreateCategoryDto) {
    return { category: await this.categoryService.create(dto) };
  }

  @Post("seed-defaults")
  async seedDefaults() {
    return { categories: await this.categoryService.seedDefaults() };
  }
}
