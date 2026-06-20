import { Injectable } from "@nestjs/common";
import { CategoryService } from "../category/category.service";
import { RentalListingService } from "../rental-listing/rental-listing.service";
import { UserService } from "../user/user.service";

@Injectable()
export class AdminService {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly rentalListingService: RentalListingService,
    private readonly userService: UserService,
  ) {}

  async getDashboard() {
    const [categories, users, listings] = await Promise.all([
      this.categoryService.getAll(),
      this.userService.getAll(),
      this.rentalListingService.getAllForAdmin(500),
    ]);
    const listingsStats = {
      active: listings.filter((item) => item.moderationStatus === "active").length,
      pending: listings.filter((item) => item.moderationStatus === "pending").length,
      rejected: listings.filter((item) => item.moderationStatus === "rejected").length,
      hidden: listings.filter((item) => item.moderationStatus === "hidden").length,
    };
    return {
      categoriesCount: categories.length,
      usersCount: users.length,
      listingsStats,
    };
  }

  async getListingsPreview() {
    const data = await this.rentalListingService.getAllForAdmin(200);
    return {
      data,
      total: data.length,
      page: 1,
      totalPages: 1,
    };
  }

  /** Пользователи с агрегатами (кол-во объявлений/броней) и фильтрами. */
  async getUsersWithAggregates(filters: {
    role?: "renter" | "business" | "admin";
    verification?: "pending" | "approved" | "rejected" | "none";
  }) {
    return this.userService.getAdminUserList(filters);
  }

  /** Блокировка/разблокировка пользователя. */
  async setUserBlocked(userId: string, isBlocked: boolean) {
    const user = await this.userService.setBlocked(userId, isBlocked);
    // Не утекаем пароль/служебные поля наружу.
    return {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roles: user.roles,
      isBlocked: user.isBlocked,
      isRenterVerified: user.isRenterVerified,
    };
  }
}
