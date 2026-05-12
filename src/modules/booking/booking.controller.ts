import {
  Body,
  Controller,
  Get,
  Post,
  ForbiddenException,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { BookingService } from "./booking.service";
import { CreateBookingDto } from "./dto/create-booking.dto";

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
}
