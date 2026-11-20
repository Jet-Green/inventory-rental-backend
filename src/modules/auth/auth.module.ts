import { Module, forwardRef } from "@nestjs/common";
import { TokenModule } from "../token/token.module";
import { UserModule } from "../user/user.module";
import { FederationService } from './federation.service';
import { FederationController } from './federation.controller';
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [forwardRef(() => UserModule), TokenModule],
  controllers: [AuthController, FederationController],
  providers: [AuthService, FederationService],
  exports: [AuthService],
})
export class AuthModule {}
