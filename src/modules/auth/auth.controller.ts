import {
  Body,
  UnauthorizedException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import { HandoffStartDto, HandoffCompleteDto } from "./dto/handoff.dto";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegistrationDto } from "./dto/registration.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    roles: string[],
  ): void {
    const secure = process.env.HTTPS === "true";
    const domain = process.env.DOMAIN || undefined;

    res.cookie("refreshToken", refreshToken, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure,
      domain,
      sameSite: "lax",
    });
    res.cookie("token", accessToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure,
      domain,
      sameSite: "lax",
    });
    res.cookie("roles", JSON.stringify(roles), {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      secure,
      domain,
      sameSite: "lax",
    });
  }

  private handoffCookieOptions() {
    return { httpOnly: true, secure: process.env.HTTPS === "true", sameSite: "lax" as const,
      path: "/api/auth/gorodaivesi" };
  }

  @Post("gorodaivesi/start")
  startHandoff(@Body() payload: HandoffStartDto, @Res({ passthrough: true }) res: Response) {
    const state = randomBytes(32).toString("hex");
    res.cookie("rentalHandoff", state, { ...this.handoffCookieOptions(), maxAge: 5 * 60 * 1000 });
    res.setHeader("Cache-Control", "no-store");
    const query = new URLSearchParams({ state, listingId: payload.listingId });
    return { url: `https://gorodaivesi.ru/rental/auth?${query}` };
  }

  @Post("gorodaivesi/complete")
  async completeHandoff(@Body() payload: HandoffCompleteDto, @Req() req: Request,
    @Res({ passthrough: true }) res: Response) {
    const expected = req.cookies?.rentalHandoff;
    if (typeof expected !== "string" || !/^[a-f0-9]{64}$/.test(expected) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(payload.state)))
      throw new UnauthorizedException("Переход открыт в другом браузере или истёк");
    res.clearCookie("rentalHandoff", this.handoffCookieOptions());
    res.setHeader("Cache-Control", "no-store");
    const data = await this.authService.completeHandoff(payload.code, payload.state);
    this.setAuthCookies(res, data.accessToken, data.refreshToken, data.user?.roles || []);
    return { user: data.user, path: `/rental-item/${data.listingId}` };
  }

  @HttpCode(HttpStatus.CREATED)
  @Post("registration")
  async registration(
    @Body() payload: RegistrationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.registration(payload);
    this.setAuthCookies(
      res,
      data.accessToken,
      data.refreshToken,
      data.user?.roles || [],
    );
    return { user: data.user };
  }

  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(
    @Body() payload: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.login(payload);
    this.setAuthCookies(
      res,
      data.accessToken,
      data.refreshToken,
      data.user?.roles || [],
    );
    return { user: data.user };
  }

  @HttpCode(HttpStatus.OK)
  @Post("gorodaivesi/login")
  async gorodaivesiLogin(
    @Body() payload: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.gorodaivesiLogin(payload);
    this.setAuthCookies(
      res,
      data.accessToken,
      data.refreshToken,
      data.user?.roles || [],
    );
    return { user: data.user };
  }

  @HttpCode(HttpStatus.OK)
  @Get("refresh")
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.refresh(
      req.cookies?.refreshToken,
      req.cookies?.token,
    );

    this.setAuthCookies(
      res,
      data.accessToken as string,
      data.refreshToken as string,
      data.user?.roles || [],
    );
    return data.user;
  }

  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.cookies?.refreshToken);
    res.clearCookie("refreshToken").clearCookie("token").clearCookie("roles");
    return { ok: true };
  }

  @Get("me")
  async me(@Req() req: Request) {
    const user = await this.authService.getUserFromRequest(req);
    return { user };
  }
}
