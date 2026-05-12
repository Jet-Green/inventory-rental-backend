import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { TokenService } from "../token/token.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UserService } from "./user.service";

@Controller("user")
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
  ) {}

  private async getCurrentUser(req: Request) {
    const payload = this.tokenService.validateAccessToken(req.cookies?.token);
    if (!payload?._id) return null;
    return this.userService.getById(payload._id);
  }

  @Get("me")
  async me(@Req() req: Request) {
    const user = await this.getCurrentUser(req);
    return { user };
  }

  @Post("update")
  async update(@Req() req: Request, @Body() payload: UpdateProfileDto) {
    const currentUser = await this.getCurrentUser(req);
    if (!currentUser) throw new UnauthorizedException("Требуется авторизация");
    const user = await this.userService.updateProfileById(
      currentUser._id.toString(),
      payload,
    );
    return { user };
  }

  @Post("verify-lessor")
  async verifyLessor(@Req() req: Request) {
    const currentUser = await this.getCurrentUser(req);
    if (!currentUser) throw new UnauthorizedException("Требуется авторизация");
    const user = await this.userService.requestLessorVerificationById(
      currentUser._id.toString(),
    );
    return { user };
  }

  @Post("verify-renter")
  async verifyRenter(@Req() req: Request) {
    const currentUser = await this.getCurrentUser(req);
    if (!currentUser) throw new UnauthorizedException("Требуется авторизация");
    const user = await this.userService.verifyRenterById(
      currentUser._id.toString(),
    );
    return { user };
  }

  @Get("all")
  async getAll() {
    return { users: await this.userService.getAll() };
  }
}
