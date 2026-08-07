import { EmailService } from "./EmailService";
import { ConsoleEmailService } from "./ConsoleEmailService";
import { ResendEmailService } from "./ResendEmailService";
import { BrevoEmailService } from "./BrevoEmailService";

export function getEmailService(): EmailService {
  const provider = process.env.EMAIL_PROVIDER || "console";
  switch (provider) {
    case "resend":
      return new ResendEmailService();
    case "brevo":
      return new BrevoEmailService();
    case "console":
    default:
      return new ConsoleEmailService();
  }
}
