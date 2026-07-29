import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";

@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}

  sendVerification(email: string, token: string): Promise<"smtp" | "preview" | "failed"> {
    const url = `${this.config.getOrThrow<string>("APP_ORIGIN")}/#/verify-email?token=${encodeURIComponent(token)}`;
    return this.deliver({
      to: email,
      subject: "[CampFlow] 이메일을 확인해 주세요",
      text: `CampFlow 이메일 확인 링크입니다. ${url}`,
    });
  }

  sendPasswordReset(email: string, token: string): Promise<"smtp" | "preview" | "failed"> {
    const url = `${this.config.getOrThrow<string>("APP_ORIGIN")}/#/reset-password?token=${encodeURIComponent(token)}`;
    return this.deliver({
      to: email,
      subject: "[CampFlow] 비밀번호 재설정",
      text: `CampFlow 비밀번호 재설정 링크입니다. ${url}`,
    });
  }

  private async deliver(message: {
    to: string;
    subject: string;
    text: string;
  }): Promise<"smtp" | "preview" | "failed"> {
    const host = this.config.get<string>("SMTP_HOST");
    if (!host) {
      return this.config.get<string>("NODE_ENV") === "production" ? "failed" : "preview";
    }

    const port = this.config.get<number>("SMTP_PORT", 587);
    const user = this.config.get<string>("SMTP_USER");
    const password = this.config.get<string>("SMTP_PASSWORD");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      ...(user && password ? { auth: { user, pass: password } } : {}),
    });
    try {
      await transporter.sendMail({
        from: this.config.get<string>("SMTP_FROM") ?? user ?? "CampFlow <no-reply@localhost>",
        ...message,
      });
      return "smtp";
    } catch {
      return "failed";
    }
  }
}
