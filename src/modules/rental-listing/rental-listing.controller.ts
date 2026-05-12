import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  ForbiddenException,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { CatalogRequestDto } from "./dto/catalog.dto";
import { CreateListingDto } from "./dto/create-listing.dto";
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
    if (!roles.includes("lessor") && !roles.includes("admin")) {
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

  @Get(":id")
  async getById(@Param("id") id: string) {
    const listing = await this.rentalListingService.getById(id);
    if (!listing) throw new NotFoundException("Объявление не найдено");
    return { listing };
  }
}
