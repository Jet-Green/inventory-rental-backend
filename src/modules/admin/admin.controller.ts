import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CookieAuthGuard } from "../../common/auth/cookie-auth.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { RolesGuard } from "../../common/auth/roles.guard";
import { OrganizationDecisionDto } from "../organization/dto/organization-decision.dto";
import { OrganizationService } from "../organization/organization.service";
import { AdminService } from "./admin.service";

@Controller("admin")
@UseGuards(CookieAuthGuard, RolesGuard)
@Roles("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly organizationService: OrganizationService,
  ) {}

  @Get("dashboard")
  async dashboard() {
    return this.adminService.getDashboard();
  }

  @Get("listings")
  async listings() {
    return this.adminService.getListingsPreview();
  }

  /** Очередь модерации организаций (отдельная коллекция `organizations`). */
  @Get("organization-verification-requests")
  async organizationVerificationRequests() {
    return {
      organizations:
        await this.organizationService.findPendingForAdmin(),
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
