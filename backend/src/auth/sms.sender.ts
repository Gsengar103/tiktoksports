import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Env } from "../config/env";

@Injectable()
export class SmsSender {
  private readonly logger = new Logger(SmsSender.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async sendCode(phone: string, code: string): Promise<void> {
    const sid = this.config.get("TWILIO_ACCOUNT_SID", { infer: true });
    const token = this.config.get("TWILIO_AUTH_TOKEN", { infer: true });
    const from = this.config.get("TWILIO_FROM", { infer: true });
    if (sid && token && from) {
      await this.sendTwilio(sid, token, from, phone, code);
      return;
    }
    if (this.config.get("NODE_ENV", { infer: true }) === "production") {
      throw new ServiceUnavailableException("Phone sign-in is not configured");
    }
    this.logger.log(`Dev phone OTP for ${phone}: ${code}`);
  }

  private async sendTwilio(sid: string, token: string, from: string, phone: string, code: string): Promise<void> {
    const body = new URLSearchParams({
      To: phone,
      From: from,
      Body: `Your Sports sign-in code is ${code}. It expires in 5 minutes.`,
    });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!response.ok) {
      this.logger.error(`Twilio SMS failed (${response.status})`);
      throw new ServiceUnavailableException("Could not send the code");
    }
  }
}
