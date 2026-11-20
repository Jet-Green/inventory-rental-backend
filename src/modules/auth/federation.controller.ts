import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthCookiesService } from './auth-cookies.service';
import { FederationService } from './federation.service';
class StartDto { @IsOptional() @IsString() @MaxLength(2048) returnPath?: string; }
class StateDto { @Matches(/^[a-f0-9]{64}$/) state: string; }
class CompleteDto extends StateDto { @Matches(/^[a-f0-9]{64}$/) code: string; }
class ConfirmDto { @Matches(/^[a-f0-9]{64}$/) receipt: string; @Matches(/^[a-f0-9]{24}$/) remoteId: string; }
class LinkDto extends StateDto { @IsEmail() email: string; @IsString() @MaxLength(256) password: string; }
@Controller('auth/federation')
export class FederationController {
  constructor(private federation: FederationService, private authCookies: AuthCookiesService) {}
  private options() { return { httpOnly: true, secure: process.env.HTTPS === 'true', sameSite: 'lax' as const, path: '/api/auth/federation' }; }
  private result(res: Response, data: any) {
    res.clearCookie('rentalFederation', this.options());
    this.authCookies.write(res, data.accessToken, data.refreshToken, data.user.roles || []);
    return { user: data.user, path: data.path };
  }
  @Post('start') async start(@Body() data: StartDto, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const result = await this.federation.invoke('start', data.returnPath);
    res.cookie('rentalFederation', result.browser, { ...this.options(), maxAge: 300000 });
    return { url: result.url };
  }
  @Post('issue') async issue(@Body() data: StateDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.federation.invoke('issue', data.state, await this.federation.issuingUser(req));
  }
  @Post('exchange') async exchange(@Body() data: CompleteDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.federation.invoke('exchange', data.code, data.state, req.headers['x-rental-handoff-secret']);
  }
  @Post('confirm') async confirm(@Body() data: ConfirmDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.federation.invoke('confirm', data.receipt, data.remoteId, req.headers['x-rental-handoff-secret']);
  }
  @Post('complete') async complete(@Body() data: CompleteDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.result(res, await this.federation.invoke('complete', data.code, data.state, req.cookies?.rentalFederation));
  }
  @Post('link') async link(@Body() data: LinkDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    await this.federation.invoke('checkLink', data.state, req.cookies?.rentalFederation);
    const user = await this.federation.nativeProof(data.email, data.password);
    return this.result(res, await this.federation.invoke('finish', data.state, req.cookies?.rentalFederation, user));
  }
}
