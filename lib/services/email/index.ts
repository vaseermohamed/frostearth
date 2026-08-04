import { EmailService } from "./EmailService";
import { ConsoleEmailService } from "./ConsoleEmailService";
import { ResendEmailService } from "./ResendEmailService";

export function getEmailService(): EmailService {
  const provider = process.env.EMAIL_PROVIDER || "console";
  switch (provider) {
    case "resend":
      return new ResendEmailService();
    case "console":
    default:
      return new ConsoleEmailService();
  }
}
