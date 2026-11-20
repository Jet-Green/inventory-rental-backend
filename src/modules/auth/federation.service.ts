import { Injectable, HttpException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Schema } from 'mongoose';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { FederationCore } from './federation-core';
import { TokenService } from '../token/token.service';
import { UserService } from '../user/user.service';

@Injectable()
export class FederationService {
  readonly core: FederationCore;
  constructor(@InjectConnection() connection: Connection, private users: UserService, private tokens: TokenService) {
    const flowSchema = new Schema({ kind: String, state: String, browserHash: String, codeHash: String, userId: String, path: String, phase: String, expectedLocalId: String, linkAttempts: Number, remote: Schema.Types.Mixed, expiresAt: { type: Date, required: true, expires: 0 } });
    flowSchema.index({ kind: 1, state: 1 });
    flowSchema.index({ codeHash: 1 }, { unique: true, sparse: true });
    const linkSchema = new Schema({ localId: { type: String, required: true, unique: true }, remoteId: { type: String, required: true, unique: true } }, { timestamps: true });
    const Flow = connection.models.FederationFlow || connection.model('FederationFlow', flowSchema);
    const Link = connection.models.FederationLink || connection.model('FederationLink', linkSchema);
    this.core = new FederationCore({ Flow, Link,
      peerWeb: 'https://gorodaivesi.ru', peerApi: 'https://gorodaivesi.ru',
      getUser: (id: string) => users.getById(id),
      findMirror: (remoteId: string) => users.findFederationMirror(remoteId),
      findEmail: (email: string) => users.getByEmail(email),
      createMirror: (remote: { _id: string; email: string; fullName?: string }) => users.createFederationMirror(remote),
      session: async (user: any) => {
        const session = tokens.generateTokens({ _id: String(user._id) });
        await tokens.saveToken(session.refreshToken);
        const publicUser = user.toObject(); delete publicUser.password;
        return { user: publicUser, ...session };
      },
    });
  }
  async invoke(operation: string, ...args: any[]) {
    try {
      // Await Mongo uniqueness constraints before a first-request race can write.
      await Promise.all([this.core.Flow.init(), this.core.Link.init()]);
      return await (this.core as any)[operation](...args);
    }
    catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (error.status) throw new HttpException({ message: error.message, ...(error.code ? { code: error.code } : {}) }, error.status);
      throw error;
    }
  }
  async nativeProof(email: string, password: string) {
    const user = typeof email === 'string' ? await this.users.getByEmailWithPassword(email) : null;
    if (!user || user.federationOnly || user.isBlocked || typeof password !== 'string' || password.length > 256 || !await bcrypt.compare(password, user.password)) throw new HttpException('Проверьте email и пароль этого сайта', 401);
    return user;
  }
  async issuingUser(req: any) {
    const refresh = req.cookies?.refreshToken;
    const payload = this.tokens.validateRefreshToken(refresh);
    if (!payload?._id || !await this.tokens.findToken(refresh)) throw new HttpException('Требуется вход', 401);
    const user = await this.users.getById(payload._id);
    if (!user || user.isBlocked) throw new HttpException('Аккаунт недоступен', 401);
    return user;
  }
}
