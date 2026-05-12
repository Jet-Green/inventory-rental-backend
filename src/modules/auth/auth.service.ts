import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import type { Request } from "express";
import { TokenService } from "../token/token.service";
import { LoginDto } from "./dto/login.dto";
import { RegistrationDto } from "./dto/registration.dto";
import { UserService } from "../user/user.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
  ) {}

  async registration(payload: RegistrationDto) {
    const candidate = await this.userService.getByEmail(payload.email);
    if (candidate) {
      throw new BadRequestException("Пользователь с таким email уже существует");
    }

    const hash = await bcrypt.hash(payload.password, 4);
    const user = await this.userService.createLocalUser({
      ...payload,
      password: hash,
    });

    const tokens = this.tokenService.generateTokens({ _id: user._id.toString() });
    await this.tokenService.saveToken(tokens.refreshToken);

    const publicUser = await this.userService.getById(user._id.toString());
    return { user: publicUser, ...tokens };
  }

  async login(payload: LoginDto) {
    const user = await this.userService.getByEmailWithPassword(payload.email);
    if (!user) {
      throw new BadRequestException("Пользователь с таким email не найден");
    }

    const isValidPassword = await bcrypt.compare(payload.password, user.password);
    if (!isValidPassword) {
      throw new BadRequestException("Неверный пароль");
    }

    const tokens = this.tokenService.generateTokens({ _id: user._id.toString() });
    await this.tokenService.saveToken(tokens.refreshToken);

    const publicUser = await this.userService.getById(user._id.toString());
    return { user: publicUser, ...tokens };
  }

  async refresh(refreshToken?: string, accessToken?: string) {
    const accessData = this.tokenService.validateAccessToken(accessToken);
    if (accessData?._id) {
      const user = await this.userService.getById(accessData._id);
      return { user, accessToken, refreshToken };
    }

    const refreshData = this.tokenService.validateRefreshToken(refreshToken);
    if (!refreshData?._id || !refreshToken) {
      throw new UnauthorizedException("Нужна авторизация");
    }

    const tokenFromDb = await this.tokenService.findToken(refreshToken);
    if (!tokenFromDb) {
      throw new UnauthorizedException("Сессия истекла");
    }

    const user = await this.userService.getById(refreshData._id);
    if (!user) {
      throw new UnauthorizedException("Пользователь не найден");
    }

    const newAccessToken = this.tokenService.generateAccessToken({ _id: user._id.toString() });
    return {
      user,
      refreshToken,
      accessToken: newAccessToken,
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      await this.tokenService.removeToken(refreshToken);
    }
  }

  async getUserFromRequest(req: Request) {
    const token = req.cookies?.token as string | undefined;
    const payload = this.tokenService.validateAccessToken(token);
    if (!payload?._id) return null;
    return this.userService.getById(payload._id);
  }

  async requireUserFromRequest(req: Request) {
    const user = await this.getUserFromRequest(req);
    if (!user) {
      throw new UnauthorizedException("Требуется авторизация");
    }
    return user;
  }
}
