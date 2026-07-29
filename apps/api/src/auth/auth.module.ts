import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CsrfGuard } from "./csrf.guard";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [JwtModule.register({ global: true }), MailModule],
  controllers: [AuthController],
  providers: [AuthService, CsrfGuard],
})
export class AuthModule {}
