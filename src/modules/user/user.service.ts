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

  /** Блокировка/разблокировка пользователя (админ). */
  async setBlocked(userId: string, isBlocked: boolean): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException("Пользователь не найден");
    }
    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { isBlocked } },
        { returnDocument: "after" },
      )
      .exec();
    if (!updated) throw new NotFoundException("Пользователь не найден");
    return updated;
  }

  /**
   * Список пользователей для админки с фильтрами и агрегатами.
   * verification — статус верификации через organization.moderationStatus.
   */
  async getAdminUserList(filters: {
    role?: "renter" | "business" | "admin";
    verification?: "pending" | "approved" | "rejected" | "none";
  }): Promise<
    Array<{
      id: string;
      fullName: string;
      email: string;
      phone: string;
      roles: string[];
      isBlocked: boolean;
      isRenterVerified: boolean;
      organizationStatus: "pending" | "approved" | "rejected" | "none";
      listingsCount: number;
      bookingsCount: number;
      createdAt?: Date;
    }>
  > {
    const userMatch: Record<string, any> = {};
    if (filters.role) userMatch.roles = filters.role;

    const pipeline: any[] = [
      { $match: userMatch },
      // Кол-во объявлений пользователя.
      {
        $lookup: {
          from: "rental_listings",
          localField: "_id",
          foreignField: "ownerId",
          as: "listingsArr",
        },
      },
      // Кол-во броней пользователя (как арендатора).
      {
        $lookup: {
          from: "bookings",
          localField: "_id",
          foreignField: "renterId",
          as: "bookingsArr",
        },
      },
      // Статус верификации организации.
      {
        $lookup: {
          from: "organizations",
          localField: "_id",
          foreignField: "orgManagers",
          as: "orgArr",
        },
      },
      {
        $addFields: {
          listingsCount: { $size: "$listingsArr" },
          bookingsCount: { $size: "$bookingsArr" },
          organizationStatus: {
            $ifNull: [{ $arrayElemAt: ["$orgArr.moderationStatus", 0] }, "none"],
          },
        },
      },
      {
        $project: {
          fullName: 1,
          email: 1,
          phone: 1,
          roles: 1,
          isBlocked: 1,
          isRenterVerified: 1,
          organizationStatus: 1,
          listingsCount: 1,
          bookingsCount: 1,
          createdAt: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    if (filters.verification) {
      pipeline.push({
        $match: { organizationStatus: filters.verification },
      });
    }

    const rows = await this.userModel.aggregate(pipeline).exec();
    return rows.map((r: any) => ({
      id: r._id.toString(),
      fullName: r.fullName,
      email: r.email,
      phone: r.phone,
      roles: r.roles || [],
      isBlocked: Boolean(r.isBlocked),
      isRenterVerified: Boolean(r.isRenterVerified),
      organizationStatus: r.organizationStatus,
      listingsCount: r.listingsCount || 0,
      bookingsCount: r.bookingsCount || 0,
      createdAt: r.createdAt,
    }));
  }
}
