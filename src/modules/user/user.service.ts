import { Injectable } from "@nestjs/common";
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
      status: "person",
      isLessorVerified: false,
      lessorVerificationStatus: "not_requested",
      isRenterVerified: true,
      isBlocked: false,
      roles: isAdmin ? ["renter", "admin"] : ["renter"],
    });
  }

  async updateProfileById(userId: string, payload: UpdateProfileDto): Promise<UserDocument> {
    return (await this.userModel
      .findByIdAndUpdate(userId, { $set: payload }, { new: true })
      .exec()) as UserDocument;
  }

  async requestLessorVerificationById(userId: string): Promise<UserDocument> {
    return (await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            lessorVerificationStatus: "pending",
            lessorVerificationComment: "",
          },
        },
        { new: true },
      )
      .exec()) as UserDocument;
  }

  async approveLessorVerificationById(
    userId: string,
    comment?: string,
  ): Promise<UserDocument> {
    return (await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            isLessorVerified: true,
            lessorVerificationStatus: "approved",
            lessorVerificationComment: comment || "",
          },
          $addToSet: { roles: "lessor" },
        },
        { new: true },
      )
      .exec()) as UserDocument;
  }

  async rejectLessorVerificationById(
    userId: string,
    comment?: string,
  ): Promise<UserDocument> {
    return (await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            isLessorVerified: false,
            lessorVerificationStatus: "rejected",
            lessorVerificationComment:
              comment || "Заявка отклонена администратором",
          },
          $pull: { roles: "lessor" },
        },
        { new: true },
      )
      .exec()) as UserDocument;
  }

  async verifyRenterById(userId: string): Promise<UserDocument> {
    return (await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { isRenterVerified: true }, $addToSet: { roles: "renter" } },
        { new: true },
      )
      .exec()) as UserDocument;
  }

  hasRole(user: UserDocument | null, role: "renter" | "lessor" | "admin"): boolean {
    if (!user) return false;
    return Array.isArray(user.roles) && user.roles.includes(role);
  }

  async getAll(): Promise<UserDocument[]> {
    return this.userModel.find({}).sort({ createdAt: -1 }).exec();
  }

  async getLessorVerificationRequests(): Promise<UserDocument[]> {
    return this.userModel
      .find({ lessorVerificationStatus: { $in: ["pending", "rejected"] } })
      .sort({ updatedAt: -1 })
      .exec();
  }
}
