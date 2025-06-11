import type { Bindings } from "../types";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private resendApiKey: string;

  constructor(resendApiKey: string) {
    this.resendApiKey = resendApiKey;
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    if (!this.resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    // Use onboarding@resend.dev for development - this is Resend's testing domain
    const fromEmail = "onboarding@resend.dev";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to send email:", errorText);
      throw new Error("Failed to send email");
    }
  }

  async sendVerificationCode(email: string, code: string, type: 'login_register' | 'verification'): Promise<void> {
    const subject = type === 'login_register' 
      ? "Your Capture login code" 
      : "Verify your email address";
    
    const html = type === 'login_register' 
      ? this.getLoginCodeTemplate(code)
      : this.getVerificationTemplate(code);

    const text = type === 'login_register'
      ? `Your Capture login code is: ${code}. This code expires in 10 minutes.`
      : `Your verification code is: ${code}. This code expires in 10 minutes.`;

    await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  private getLoginCodeTemplate(code: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Your Capture Login Code</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; padding: 40px 20px;">
            <h1 style="color: #1C1C1C; margin-bottom: 20px;">Welcome to Capture</h1>
            <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
              Use this code to continue to your account:
            </p>
            <div style="background-color: #f5f5f5; padding: 30px; border-radius: 10px; margin: 30px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1C1C1C;">${code}</span>
            </div>
            <p style="font-size: 14px; color: #999;">
              This code expires in 10 minutes. If you didn't request this code, please ignore this email.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private getVerificationTemplate(code: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; padding: 40px 20px;">
            <h1 style="color: #1C1C1C; margin-bottom: 20px;">Verify Your Email</h1>
            <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
              Enter this code to verify your email address:
            </p>
            <div style="background-color: #f5f5f5; padding: 30px; border-radius: 10px; margin: 30px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1C1C1C;">${code}</span>
            </div>
            <p style="font-size: 14px; color: #999;">
              This code expires in 10 minutes.
            </p>
          </div>
        </body>
      </html>
    `;
  }
}

export function createEmailService(env: Bindings): EmailService {
  return new EmailService(env.RESEND_API_KEY);
} 