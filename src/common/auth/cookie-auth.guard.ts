import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../../modules/auth/auth.service";

@Injectable()
export class CookieAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = await this.authService.getUserFromRequest(req);
    if (!user) {
      throw new UnauthorizedException("Требуется авторизация");
    }
    (req as any).user = user;
    return true;
  }
}

