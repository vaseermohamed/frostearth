export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Not wired to a real provider in the MVP (no requirement for it yet),
 * but every place that will eventually need to email a buyer — order
 * receipts, download links — calls this interface now so plugging in
 * Resend/Postmark/SES later touches one file, not every route.
 */
export interface EmailService {
  send(input: SendEmailInput): Promise<void>;
}
