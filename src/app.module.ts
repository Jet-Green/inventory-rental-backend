import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./modules/admin/admin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BookingModule } from "./modules/booking/booking.module";
import { CategoryModule } from "./modules/category/category.module";
import { RentalListingModule } from "./modules/rental-listing/rental-listing.module";
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
    CategoryModule,
    RentalListingModule,
    BookingModule,
    AdminModule,
  ],
})
export class AppModule {}
