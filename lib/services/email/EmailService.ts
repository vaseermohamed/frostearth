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
 *
 * send() resolves to true/false rather than throwing — a failed send
 * must never fail the checkout itself (the buyer already has working
 * download links on-screen from the client-confirmation path), but
 * callers that DO need to know the outcome (e.g. an admin resend,
 * which records success/failure in EmailDelivery) still can.
 */
export interface EmailService {
  send(input: SendEmailInput): Promise<boolean>;
}
