import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import * as jwt from "jsonwebtoken";
import { Model } from "mongoose";
import { Token, TokenDocument } from "./schemas/token.schema";

@Injectable()
export class TokenService {
  constructor(
    @InjectModel(Token.name)
    private readonly tokenModel: Model<TokenDocument>,
  ) {}

  generateTokens(payload: { _id: string }): {
    accessToken: string;
    refreshToken: string;
  } {
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET || "access-secret", {
      expiresIn: "7d",
    });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || "refresh-secret", {
      expiresIn: "30d",
    });
    return { accessToken, refreshToken };
  }

  generateAccessToken(payload: { _id: string }): string {
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET || "access-secret", {
      expiresIn: "7d",
    });
  }

  validateAccessToken(token?: string): { _id: string } | null {
    if (!token) return null;
    try {
      return jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || "access-secret",
      ) as { _id: string };
    } catch {
      return null;
    }
  }

  validateRefreshToken(token?: string): { _id: string } | null {
    if (!token) return null;
    try {
      return jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET || "refresh-secret",
      ) as { _id: string };
    } catch {
      return null;
    }
  }

  async saveToken(refreshToken: string): Promise<TokenDocument> {
    return this.tokenModel.create({ refreshToken });
  }

  async removeToken(refreshToken: string): Promise<void> {
    await this.tokenModel.deleteOne({ refreshToken }).exec();
  }

  async findToken(refreshToken: string): Promise<TokenDocument | null> {
    return this.tokenModel.findOne({ refreshToken }).exec();
  }
}
