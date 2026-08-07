import { EmailService, SendEmailInput } from "./EmailService";

/**
 * Brevo's transactional email API (https://api.brevo.com/v3/smtp/email).
 * Plain fetch rather than Brevo's SDK — one REST call doesn't need a whole
 * package dependency. Same EmailService contract as Resend/Console, so
 * OrderService never knows which provider is active.
 */
export class BrevoEmailService implements EmailService {
  private apiKey: string;
  private senderName: string;
  private senderEmail: string;

  constructor() {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) throw new Error("BREVO_API_KEY is not configured");
    this.apiKey = apiKey;

    // Reuses EMAIL_FROM (same "Name <email>" value Resend already reads)
    // rather than adding a parallel BREVO_FROM — Brevo's API just wants
    // that same identity split into {name, email}.
    const { name, email } = parseFromAddress(process.env.EMAIL_FROM || "FrostEarth <onboarding@resend.dev>");
    this.senderName = name;
    this.senderEmail = email;
  }

  async send(input: SendEmailInput): Promise<void> {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: this.senderName, email: this.senderEmail },
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.html,
      }),
    });

    if (!res.ok) {
      // Don't throw — a failed email must never fail the checkout itself
      // (see OrderService.sendReceiptEmail), same as ResendEmailService.
      const body = await res.text().catch(() => "");
      console.error("[email:brevo] send failed:", res.status, body);
    }
  }
}

function parseFromAddress(from: string): { name: string; email: string } {
  const match = from.match(/^(.*)<(.+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim() };
  }
  return { name: "FrostEarth", email: from.trim() };
}
