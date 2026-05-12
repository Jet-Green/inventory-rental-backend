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
import { LessorVerificationDecisionDto } from "../user/dto/lessor-verification-decision.dto";
import { UserService } from "../user/user.service";
import { AdminService } from "./admin.service";

@Controller("admin")
@UseGuards(CookieAuthGuard, RolesGuard)
@Roles("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly userService: UserService,
  ) {}

  @Get("dashboard")
  async dashboard() {
    return this.adminService.getDashboard();
  }

  @Get("listings")
  async listings() {
    return this.adminService.getListingsPreview();
  }

  @Get("lessor-verification-requests")
  async lessorVerificationRequests() {
    return { users: await this.userService.getLessorVerificationRequests() };
  }

  @Post("lessor-verification/approve")
  async approveLessorVerification(
    @Body() payload: LessorVerificationDecisionDto,
  ) {
    const user = await this.userService.approveLessorVerificationById(
      payload.userId,
      payload.comment,
    );
    return { user };
  }

  @Post("lessor-verification/reject")
  async rejectLessorVerification(
    @Body() payload: LessorVerificationDecisionDto,
  ) {
    const user = await this.userService.rejectLessorVerificationById(
      payload.userId,
      payload.comment,
    );
    return { user };
  }
}
