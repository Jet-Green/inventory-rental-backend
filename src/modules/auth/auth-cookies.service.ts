import { Injectable } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';

// Rental SSR needs the Rental subtree, never the parent shared with GiV.
const RENTAL_ROOTS = ['rent.gorodaivesi.ru', 'rent.firetechno.ru'] as const;
export function rentalCookieDomain(value: string | undefined): string | undefined {
  const domain = value?.trim().replace(/^\./, '').toLowerCase();
  if (!domain || domain === 'localhost') return undefined;
  if (!RENTAL_ROOTS.some(root => domain === root || domain === `api.${root}`)) {
    throw new Error('DOMAIN должен принадлежать поддомену Аренды');
  }
  return domain;
}

@Injectable()
export class AuthCookiesService {
  private readonly domain = rentalCookieDomain(process.env.DOMAIN);
  private options(domain?: string, httpOnly = true): CookieOptions {
    return { httpOnly, secure: process.env.HTTPS === 'true', sameSite: 'lax', path: '/', domain };
  }

  clear(res: Response): void {
    // Delete both scopes before choosing the final scope. Without this migration,
    // cookie-parser can select an older same-name session in the browser header.
    const scopes = new Set<string | undefined>([undefined, this.domain]);
    for (const root of RENTAL_ROOTS) {
      scopes.add(root);
      scopes.add(`api.${root}`);
    }
    for (const domain of scopes) {
      for (const name of ['refreshToken', 'token', 'roles']) {
        res.clearCookie(name, this.options(domain, name !== 'roles'));
      }
    }
  }

  write(res: Response, accessToken: string, refreshToken: string, roles: string[]): void {
    this.clear(res);
    res.cookie('refreshToken', refreshToken, { ...this.options(this.domain), maxAge: 30 * 86400000 });
    res.cookie('token', accessToken, { ...this.options(this.domain), maxAge: 7 * 86400000 });
    res.cookie('roles', JSON.stringify(roles), { ...this.options(this.domain, false), maxAge: 7 * 86400000 });
  }

  refreshTokens(req: Request): string[] {
    const tokens = new Set<string>();
    // During migration there can be two same-name refresh cookies. Revoke both
    // on explicit logout, rather than only cookie-parser's first match.
    for (const item of (req.headers.cookie || '').split(';')) {
      const split = item.indexOf('=');
      if (split < 0 || item.slice(0, split).trim() !== 'refreshToken') continue;
      try {
        const value = decodeURIComponent(item.slice(split + 1).trim());
        if (value) tokens.add(value);
      } catch { /* An invalid cookie is still removed by clear(). */ }
    }
    if (typeof req.cookies?.refreshToken === 'string') tokens.add(req.cookies.refreshToken);
    return [...tokens];
  }
}
