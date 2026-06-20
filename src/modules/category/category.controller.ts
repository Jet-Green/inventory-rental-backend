import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CookieAuthGuard } from "../../common/auth/cookie-auth.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { RolesGuard } from "../../common/auth/roles.guard";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { ToggleVisibilityDto } from "./dto/toggle-visibility.dto";
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
  @UseGuards(CookieAuthGuard, RolesGuard)
  @Roles("admin")
  async create(@Body() dto: CreateCategoryDto) {
    return { category: await this.categoryService.create(dto) };
  }

  @Patch(":id")
  @UseGuards(CookieAuthGuard, RolesGuard)
  @Roles("admin")
  async update(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return { category: await this.categoryService.update(id, dto) };
  }

  @Patch(":id/visibility")
  @UseGuards(CookieAuthGuard, RolesGuard)
  @Roles("admin")
  async toggleVisibility(
    @Param("id") id: string,
    @Body() dto: ToggleVisibilityDto,
  ) {
    return {
      category: await this.categoryService.toggleVisibility(id, dto.isVisible),
    };
  }

  @Delete(":id")
  @UseGuards(CookieAuthGuard, RolesGuard)
  @Roles("admin")
  async remove(@Param("id") id: string) {
    return this.categoryService.remove(id);
  }

  @Post("seed-defaults")
  @UseGuards(CookieAuthGuard, RolesGuard)
  @Roles("admin")
  async seedDefaults() {
    return { categories: await this.categoryService.seedDefaults() };
  }
}
