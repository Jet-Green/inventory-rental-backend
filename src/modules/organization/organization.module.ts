import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CookieAuthGuard } from "../../common/auth/cookie-auth.guard";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../user/user.module";
import { OrganizationController } from "./organization.controller";
import { OrganizationService } from "./organization.service";
import {
  Organization,
  OrganizationSchema,
} from "./schemas/organization.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => UserModule),
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService, CookieAuthGuard],
  exports: [OrganizationService],
})
export class OrganizationModule {}
