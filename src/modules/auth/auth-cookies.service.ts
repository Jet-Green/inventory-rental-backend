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

  private scopes(res: Response): (string | undefined)[] {
    const hostname = res.req?.hostname?.toLowerCase().replace(/\.$/, '');
    const hostRoot = RENTAL_ROOTS.find(value => hostname === value || hostname?.endsWith(`.${value}`));
    if (hostRoot && this.domain && this.domain !== hostRoot && this.domain !== `api.${hostRoot}`) {
      throw new Error("DOMAIN не соответствует текущему поддомену Аренды");
    }
    const root = hostRoot || RENTAL_ROOTS.find(value => this.domain === value || this.domain === `api.${value}`);
    const scopes = new Set<string | undefined>([undefined]);
    if (root) {
      scopes.add(root);
      // Domain=<API host> differs from a host-only cookie in browsers.
      scopes.add(hostname && (hostname === root || hostname.endsWith(`.${root}`)) ? hostname : `api.${root}`);
    }
    if (this.domain) scopes.add(this.domain);
    return [...scopes];
  }

  private clearScopes(res: Response, scopes: (string | undefined)[]): void {
    for (const domain of scopes) {
      for (const name of ['refreshToken', 'token', 'roles']) {
        res.clearCookie(name, this.options(domain, name !== 'roles'));
      }
    }
  }

  clear(res: Response): void {
    this.clearScopes(res, this.scopes(res));
  }

  write(res: Response, accessToken: string, refreshToken: string, roles: string[]): void {
    // Remove competing legacy scopes. The intended scope is overwritten directly.
    this.clearScopes(res, this.scopes(res).filter(domain => domain !== this.domain));
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
