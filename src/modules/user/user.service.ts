import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { User, UserDocument } from "./schemas/user.schema";

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async getById(userId: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    return this.userModel.findById(userId).exec();
  }

  async getByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async getByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select("+password")
      .exec();
  }

  async createLocalUser(payload: {
    fullName: string;
    email: string;
    password: string;
    phone: string;
  }): Promise<UserDocument> {
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const isAdmin = adminEmails.includes(payload.email.toLowerCase().trim());

    return this.userModel.create({
      fullName: payload.fullName.trim(),
      email: payload.email.toLowerCase().trim(),
      password: payload.password,
      phone: payload.phone.trim(),
      isRenterVerified: true,
      isBlocked: false,
      roles: isAdmin ? ["renter", "admin"] : ["renter"],
    });
  }

  async updateProfileById(userId: string, payload: UpdateProfileDto): Promise<UserDocument> {
    return (await this.userModel
      .findByIdAndUpdate(userId, { $set: payload }, { returnDocument: "after" })
      .exec()) as UserDocument;
  }

  /** После одобрения организации. */
  async grantBusinessRoleById(userId: string): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $addToSet: { roles: "business" } },
        { returnDocument: "after" },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException("Пользователь не найден");
    }
    return updated;
  }

  /** После отклонения заявки организации. */
  async revokeBusinessRoleById(userId: string): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $pull: { roles: "business" } },
        { returnDocument: "after" },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException("Пользователь не найден");
    }
    return updated;
  }

  async verifyRenterById(userId: string): Promise<UserDocument> {
    return (await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { isRenterVerified: true }, $addToSet: { roles: "renter" } },
        { returnDocument: "after" },
      )
      .exec()) as UserDocument;
  }

  hasRole(user: UserDocument | null, role: "renter" | "business" | "admin"): boolean {
    if (!user) return false;
    return Array.isArray(user.roles) && user.roles.includes(role);
  }

  async getAll(): Promise<UserDocument[]> {
    return this.userModel.find({}).sort({ createdAt: -1 }).exec();
  }

}
