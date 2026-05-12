import { Controller, Get, Query } from "@nestjs/common";
import { CategoryService } from "./category.service";

type CategoriesResponseItem = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  sortOrder?: number;
};

@Controller("categories")
export class CategoriesPublicController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  async list(@Query("isActive") isActive?: string) {
    const activeOnly = isActive === undefined ? true : isActive === "true";
    const categories = activeOnly
      ? await this.categoryService.getVisible()
      : await this.categoryService.getAll();

    const data: CategoriesResponseItem[] = categories.map((c) => ({
      id: c._id.toString(),
      title: c.name,
      slug: c.key,
      isActive: Boolean(c.isVisible),
    }));

    return { data };
  }
}

