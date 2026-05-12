import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CategoryModule } from "../category/category.module";
import { RentalListingModule } from "../rental-listing/rental-listing.module";
import { OrganizationModule } from "../organization/organization.module";
import { UserModule } from "../user/user.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [
    AuthModule,
    CategoryModule,
    RentalListingModule,
    UserModule,
    OrganizationModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
