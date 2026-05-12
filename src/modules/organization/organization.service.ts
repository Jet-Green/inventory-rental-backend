import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { UserService } from "../user/user.service";
import { SubmitOrganizationVerificationDto } from "./dto/submit-organization-verification.dto";
import {
  Organization,
  OrganizationDocument,
} from "./schemas/organization.schema";

@Injectable()
export class OrganizationService {
  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>,
    private readonly userService: UserService,
  ) {}

  async submitVerification(
    userId: string,
    dto: SubmitOrganizationVerificationDto,
  ): Promise<{ organization: OrganizationDocument }> {
    const uid = new Types.ObjectId(userId);
    const existing = await this.organizationModel
      .findOne({ orgManagers: uid })
      .exec();

    if (existing?.moderationStatus === "approved") {
      throw new BadRequestException(
        "Организация уже подтверждена. Новая заявка не требуется.",
      );
    }

    const payload = {
      legalStatus: dto.legalStatus,
      inn: dto.inn,
      ogrnOrOgrnip: dto.ogrnOrOgrnip,
      companyName: dto.companyName,
      payoutPhone: dto.payoutPhone,
      moderationStatus: "pending" as const,
      moderatorComment: "",
    };

    let organization: OrganizationDocument;

    if (existing) {
      organization = (await this.organizationModel
        .findByIdAndUpdate(
          existing._id,
          {
            $set: {
              ...payload,
              ...(existing.moderationStatus === "rejected"
                ? { moderatorComment: "" }
                : {}),
            },
          },
          { returnDocument: "after" },
        )
        .exec()) as OrganizationDocument;
    } else {
      organization = await this.organizationModel.create({
        ...payload,
        orgManagers: [uid],
      });
    }

    return { organization };
  }

  async findMine(userId: string): Promise<OrganizationDocument | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    return this.organizationModel
      .findOne({ orgManagers: new Types.ObjectId(userId) })
      .exec();
  }

  async findPendingForAdmin(): Promise<OrganizationDocument[]> {
    return this.organizationModel
      .find({ moderationStatus: "pending" })
      .sort({ updatedAt: -1 })
      .populate({
        path: "orgManagers",
        select: "email fullName phone",
      })
      .exec();
  }

  async approveById(
    organizationId: string,
    comment?: string,
  ): Promise<{ organization: OrganizationDocument | null }> {
    if (!Types.ObjectId.isValid(organizationId)) {
      throw new NotFoundException("Заявка не найдена");
    }
    const org = await this.organizationModel
      .findById(organizationId)
      .exec();
    if (!org) throw new NotFoundException("Заявка не найдена");

    org.moderationStatus = "approved";
    org.moderatorComment = comment || "";
    await org.save();

    for (const managerId of org.orgManagers) {
      await this.userService.grantBusinessRoleById(managerId.toString());
    }

    return { organization: org };
  }

  async rejectById(
    organizationId: string,
    comment?: string,
  ): Promise<{ organization: OrganizationDocument | null }> {
    if (!Types.ObjectId.isValid(organizationId)) {
      throw new NotFoundException("Заявка не найдена");
    }
    const org = await this.organizationModel
      .findById(organizationId)
      .exec();
    if (!org) throw new NotFoundException("Заявка не найдена");

    org.moderationStatus = "rejected";
    org.moderatorComment =
      comment || "Заявка отклонена администратором";
    await org.save();

    for (const managerId of org.orgManagers) {
      await this.userService.revokeBusinessRoleById(managerId.toString());
    }

    return { organization: org };
  }
}
