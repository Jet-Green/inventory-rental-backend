import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { UserDocument } from "../user/schemas/user.schema";
import { CookieAuthGuard } from "../../common/auth/cookie-auth.guard";
import { SubmitOrganizationVerificationDto } from "./dto/submit-organization-verification.dto";
import { OrganizationService } from "./organization.service";

@Controller("organization")
@UseGuards(CookieAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  /** Организация текущего пользователя (если есть). */
  @Get("mine")
  async mine(@Req() req: Request & { user?: UserDocument }) {
    const user = req.user;
    if (!user?._id) {
      throw new UnauthorizedException("Требуется авторизация");
    }
    const organization = await this.organizationService.findMine(
      user._id.toString(),
    );
    return { organization };
  }

  @Post("submit-verification")
  async submitVerification(
    @Req() req: Request & { user?: UserDocument },
    @Body() dto: SubmitOrganizationVerificationDto,
  ) {
    const user = req.user;
    if (!user?._id) {
      throw new UnauthorizedException("Требуется авторизация");
    }
    return this.organizationService.submitVerification(
      user._id.toString(),
      dto,
    );
  }
}
