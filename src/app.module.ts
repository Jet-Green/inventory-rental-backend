import { join } from "path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ThrottlerModule } from "@nestjs/throttler";
import { StorageModule } from "./common/storage/storage.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BookingModule } from "./modules/booking/booking.module";
import { CategoryModule } from "./modules/category/category.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { RentalListingModule } from "./modules/rental-listing/rental-listing.module";
import { UploadModule } from "./modules/upload/upload.module";
import { UserModule } from "./modules/user/user.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 1000,
        limit: 20,
        blockDuration: 10 * 60_000,
      },
    ]),
    ConfigModule.forRoot({ isGlobal: true }),
    // Статическая раздача локально сохранённых файлов (fallback-режим хранилища).
    // Доступ по /uploads/* (вне глобального префикса /api).
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "uploads"),
      serveRoot: "/uploads",
    }),
    StorageModule,
    MongooseModule.forRoot(
      process.env.MONGO_URL || "mongodb://localhost:27017/inventory-rental",
      {
        connectionFactory: (connection) => {
          connection.plugin(require("mongoose-autopopulate"));
          return connection;
        },
      },
    ),
    AuthModule,
    UserModule,
    OrganizationModule,
    CategoryModule,
    RentalListingModule,
    BookingModule,
    UploadModule,
    AdminModule,
  ],
})
export class AppModule {}
