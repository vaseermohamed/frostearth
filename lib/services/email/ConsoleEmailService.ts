import { EmailService, SendEmailInput } from "./EmailService";

/** Dev-only stand-in: logs instead of sending. Swap for a real provider later. */
export class ConsoleEmailService implements EmailService {
  async send(input: SendEmailInput): Promise<void> {
    console.log("[email:stub]", input.to, input.subject);
  }
}
