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

  /**
   * Вход через «Города и Веси» (SSO, Вариант A — «проксируемый логин»).
   * Наш сервер сам обращается к их /auth/login, сопоставляет пользователя
   * и выдаёт НАШИ токены. Их секреты/токены нам не нужны.
   *
   * У «Города и Веси» нет OAuth-сервера, поэтому вход идёт по email+паролю
   * их аккаунта. Требования на их стороне: whitelist нашего серверного IP
   * (у них rate-limit 5 попыток/15 мин на IP) и наш домен в CORS allow-list.
   */
  async gorodaivesiLogin(payload: LoginDto) {
    const baseUrl = (
      process.env.GORODAIVESI_API_URL || "https://gorodaivesi.ru"
    ).replace(/\/+$/, "");

    let remote: {
      user?: {
        _id?: string;
        email?: string;
        fullname?: string;
        fullinfo?: { phone?: string };
      };
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new BadRequestException(
          "Не удалось войти через «Города и Веси»: проверьте email и пароль.",
        );
      }
      remote = (await response.json()) as typeof remote;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        "Сервис «Города и Веси» временно недоступен. Попробуйте позже.",
      );
    }

    const ext = remote.user;
    if (!ext?._id || !ext.email) {
      throw new BadRequestException(
        "Некорректный ответ сервиса «Города и Веси».",
      );
    }

    const user = await this.userService.upsertExternalUser({
      provider: "gorodaivesi",
      externalId: String(ext._id),
      email: ext.email,
      fullName: ext.fullname || ext.email,
      phone: ext.fullinfo?.phone,
    });

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
