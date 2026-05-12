import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
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
