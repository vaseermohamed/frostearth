import { Resend } from "resend";
import { EmailService, SendEmailInput } from "./EmailService";

export class ResendEmailService implements EmailService {
  private client: Resend;
  private from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
    this.client = new Resend(apiKey);
    // Resend's shared sandbox sender works without verifying a domain —
    // fine for getting started. Switch to a verified frostearth.in
    // address (e.g. noreply@frostearth.in) once the domain is verified
    // in the Resend dashboard; no code change needed, just this env var.
    this.from = process.env.EMAIL_FROM || "FrostEarth <onboarding@resend.dev>";
  }

  async send(input: SendEmailInput): Promise<void> {
    const result = await this.client.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (result.error) {
      // Don't let an email failure fail the checkout itself — the buyer
      // already has their download link on-screen. Log for follow-up.
      console.error("[email:resend] send failed:", JSON.stringify(result.error));
    }
  }
}
