import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  ForbiddenException,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { BookingService } from "./booking.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { UpdateBookingStatusDto } from "./dto/update-booking-status.dto";

@Controller("booking")
export class BookingController {
  constructor(
    private readonly authService: AuthService,
    private readonly bookingService: BookingService,
  ) {}

  @Post("create")
  async create(@Req() req: Request, @Body() dto: CreateBookingDto) {
    const user = await this.authService.requireUserFromRequest(req);
    const roles = user.roles || [];
    if (!roles.includes("renter") && !roles.includes("admin")) {
      throw new ForbiddenException("Только арендатор может создавать бронь");
    }
    return this.bookingService.create(user._id.toString(), dto);
  }

  @Get("my")
  async my(@Req() req: Request) {
    const user = await this.authService.requireUserFromRequest(req);
    const bookings = await this.bookingService.getMyBookings(user._id.toString());
    return { bookings };
  }

  /** Последние брони по всей платформе (только админ) — для дашборда. */
  @Get("admin/recent")
  async adminRecent(@Req() req: Request) {
    const user = await this.authService.requireUserFromRequest(req);
    if (!user.roles?.includes("admin")) {
      throw new ForbiddenException("Только администратор");
    }
    const bookings = await this.bookingService.getRecentBookings(8);
    return { bookings };
  }

  /** Брони по объявлениям текущего арендодателя. */
  @Get("owner")
  async owner(@Req() req: Request) {
    const user = await this.authService.requireUserFromRequest(req);
    const bookings = await this.bookingService.getOwnerBookings(
      user._id.toString(),
    );
    return { bookings };
  }

  /** Ручная смена статуса брони. */
  @Patch(":id/status")
  async updateStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    const user = await this.authService.requireUserFromRequest(req);
    const isAdmin = !!user.roles?.includes("admin");
    return this.bookingService.updateStatus(
      id,
      user._id.toString(),
      isAdmin,
      dto,
    );
  }

  /** Заглушка оплаты: pending -> confirmed. */
  @Post(":id/pay")
  async pay(@Req() req: Request, @Param("id") id: string) {
    const user = await this.authService.requireUserFromRequest(req);
    const isAdmin = !!user.roles?.includes("admin");
    return this.bookingService.pay(id, user._id.toString(), isAdmin);
  }

  /** Ссылки на договоры (только участники сделки/админ). */
  @Get(":id/contracts")
  async contracts(@Req() req: Request, @Param("id") id: string) {
    const user = await this.authService.requireUserFromRequest(req);
    const isAdmin = !!user.roles?.includes("admin");
    return this.bookingService.getContracts(id, user._id.toString(), isAdmin);
  }

  @Get("busy/:listingId")
  async busyByListing(@Param("listingId") listingId: string) {
    const busyRanges = await this.bookingService.getBusyRangesByListingId(listingId);
    return { busyRanges };
  }
}
