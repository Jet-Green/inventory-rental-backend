import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  ForbiddenException,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { CatalogRequestDto } from "./dto/catalog.dto";
import { CreateListingDto } from "./dto/create-listing.dto";
import { SetVisibilityDto } from "./dto/set-visibility.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";
import { UpdateModerationDto } from "./dto/update-moderation.dto";
import { RentalListingService } from "./rental-listing.service";

@Controller("rental-listing")
export class RentalListingController {
  constructor(
    private readonly authService: AuthService,
    private readonly rentalListingService: RentalListingService,
  ) {}

  @Post("catalog")
  async catalog(@Body() payload: CatalogRequestDto) {
    return this.rentalListingService.getCatalog(payload);
  }

  @Post("create")
  async create(@Req() req: Request, @Body() payload: CreateListingDto) {
    const user = await this.authService.requireUserFromRequest(req);
    const roles = user.roles || [];
    if (!roles.includes("business") && !roles.includes("admin")) {
      throw new ForbiddenException("Только арендодатель может создавать объявления");
    }
    const listing = await this.rentalListingService.create(user._id.toString(), payload);
    return { listing };
  }

  @Get("my")
  async my(@Req() req: Request) {
    const user = await this.authService.requireUserFromRequest(req);
    const listings = await this.rentalListingService.getByOwner(user._id.toString());
    return { listings };
  }

  @Post("moderation")
  async moderation(@Req() req: Request, @Body() payload: UpdateModerationDto) {
    const user = await this.authService.requireUserFromRequest(req);
    if (!user.roles?.includes("admin")) {
      throw new ForbiddenException("Только администратор может модерировать объявления");
    }
    const listing = await this.rentalListingService.updateModeration(payload);
    return { listing };
  }

  /** Отправить черновик/отклонённое объявление на модерацию (владелец). */
  @Post(":id/submit-moderation")
  async submitModeration(@Req() req: Request, @Param("id") id: string) {
    const user = await this.authService.requireUserFromRequest(req);
    const listing = await this.rentalListingService.submitForModeration(
      id,
      user._id.toString(),
    );
    return { listing };
  }

  /** Редактировать своё объявление (владелец). Правка опубликованного → на модерацию. */
  @Patch(":id")
  async update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() payload: UpdateListingDto,
  ) {
    const user = await this.authService.requireUserFromRequest(req);
    const listing = await this.rentalListingService.updateOwned(
      id,
      user._id.toString(),
      payload,
    );
    return { listing };
  }

  /** Скрыть/показать своё объявление (владелец). */
  @Post(":id/visibility")
  async setVisibility(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() payload: SetVisibilityDto,
  ) {
    const user = await this.authService.requireUserFromRequest(req);
    const listing = await this.rentalListingService.setVisibilityOwned(
      id,
      user._id.toString(),
      payload.hidden,
    );
    return { listing };
  }

  /** Удалить своё объявление (владелец). */
  @Delete(":id")
  async remove(@Req() req: Request, @Param("id") id: string) {
    const user = await this.authService.requireUserFromRequest(req);
    return this.rentalListingService.removeOwned(id, user._id.toString());
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    const listing = await this.rentalListingService.getById(id);
    if (!listing) throw new NotFoundException("Объявление не найдено");
    return { listing };
  }
}
