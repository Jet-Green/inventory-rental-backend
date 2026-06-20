import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CookieAuthGuard } from "../../common/auth/cookie-auth.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { RolesGuard } from "../../common/auth/roles.guard";
import { OrganizationDecisionDto } from "../organization/dto/organization-decision.dto";
import { OrganizationService } from "../organization/organization.service";
import { RentalListingService } from "../rental-listing/rental-listing.service";
import { AdminService } from "./admin.service";
import { ModerateListingDto } from "./dto/moderate-listing.dto";
import { SetBlockedDto } from "./dto/set-blocked.dto";
import { AdminUsersQueryDto } from "./dto/admin-users-query.dto";

@Controller("admin")
@UseGuards(CookieAuthGuard, RolesGuard)
@Roles("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly organizationService: OrganizationService,
    private readonly rentalListingService: RentalListingService,
  ) {}

  @Get("dashboard")
  async dashboard() {
    return this.adminService.getDashboard();
  }

  @Get("listings")
  async listings() {
    return this.adminService.getListingsPreview();
  }

  // ---------- Модерация листингов ----------

  /** Одобрить листинг (status -> active). */
  @Post("listings/:id/approve")
  async approveListing(@Param("id") id: string) {
    const listing = await this.rentalListingService.updateModeration({
      listingId: id,
      status: "active",
    });
    return { listing };
  }

  /** Отклонить листинг с причиной (status -> rejected). */
  @Post("listings/:id/reject")
  async rejectListing(
    @Param("id") id: string,
    @Body() dto: ModerateListingDto,
  ) {
    const listing = await this.rentalListingService.updateModeration({
      listingId: id,
      status: "rejected",
      rejectionReason: dto.rejectionReason,
    });
    return { listing };
  }

  /** Скрыть листинг (status -> hidden). */
  @Post("listings/:id/hide")
  async hideListing(@Param("id") id: string) {
    const listing = await this.rentalListingService.updateModeration({
      listingId: id,
      status: "hidden",
    });
    return { listing };
  }

  /** Удалить листинг. */
  @Delete("listings/:id")
  async deleteListing(@Param("id") id: string) {
    return this.rentalListingService.removeByAdmin(id);
  }

  // ---------- Пользователи ----------

  /** Список пользователей с агрегатами и фильтрами. */
  @Get("users")
  async users(@Query() query: AdminUsersQueryDto) {
    const users = await this.adminService.getUsersWithAggregates({
      role: query.role,
      verification: query.verification,
    });
    return { users, total: users.length };
  }

  /** Блокировка/разблокировка пользователя. */
  @Patch("users/:id/blocked")
  async setBlocked(@Param("id") id: string, @Body() dto: SetBlockedDto) {
    const user = await this.adminService.setUserBlocked(id, dto.isBlocked);
    return { user };
  }

  // ---------- Организации ----------

  /** Очередь модерации организаций (отдельная коллекция `organizations`). */
  @Get("organization-verification-requests")
  async organizationVerificationRequests() {
    return {
      organizations: await this.organizationService.findPendingForAdmin(),
    };
  }

  @Post("organization-verification/approve")
  async approveOrganizationVerification(@Body() payload: OrganizationDecisionDto) {
    return this.organizationService.approveById(
      payload.organizationId,
      payload.comment,
    );
  }

  @Post("organization-verification/reject")
  async rejectOrganizationVerification(@Body() payload: OrganizationDecisionDto) {
    return this.organizationService.rejectById(
      payload.organizationId,
      payload.comment,
    );
  }
}
