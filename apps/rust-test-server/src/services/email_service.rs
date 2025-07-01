use serde_json::json;
use worker::{Env, Fetch, Headers, Request, RequestInit, Result};

#[derive(Debug)]
pub struct SendEmailOptions {
    pub to: String,
    pub subject: String,
    pub html: String,
    pub text: Option<String>,
}

pub struct EmailService {
    resend_api_key: String,
}

impl EmailService {
    pub fn new(resend_api_key: String) -> Result<Self> {
        if resend_api_key.trim().is_empty() {
            return Err(worker::Error::RustError(
                "RESEND_API_KEY is not configured or is invalid.".to_string(),
            ));
        }
        Ok(EmailService { resend_api_key })
    }

    pub async fn send_email(&self, options: SendEmailOptions) -> Result<()> {
        let from_email = "noreply@verification.captureapp.org";

        let headers = Headers::new();
        headers.set("Authorization", &format!("Bearer {}", self.resend_api_key))?;
        headers.set("Content-Type", "application/json")?;

        let body = json!({
            "from": from_email,
            "to": options.to,
            "subject": options.subject,
            "html": options.html,
            "text": options.text
        });

        let mut request_init = RequestInit::new();
        request_init.method = worker::Method::Post;
        request_init.headers = headers;
        request_init.body = Some(body.to_string().into());

        let request = Request::new_with_init("https://api.resend.com/emails", &request_init)?;
        let mut response = Fetch::Request(request).send().await?;

        let status_code = response.status_code();
        if !(200..300).contains(&status_code) {
            let error_text = response.text().await.unwrap_or_default();
            worker::console_log!("Failed to send email: {} - {}", status_code, error_text);

            // Provide more specific error messages based on response
            let error_message = match status_code {
                422 => {
                    "Invalid email address format. Please check your email address and try again."
                }
                429 => "Too many email requests. Please wait a moment and try again.",
                401 | 403 => "Email service authentication failed. Please contact support.",
                status if status >= 500 => {
                    "Email service is temporarily unavailable. Please try again later."
                }
                _ => "Unable to send email. Please verify your email address and try again.",
            };

            return Err(worker::Error::RustError(error_message.to_string()));
        }

        Ok(())
    }

    pub async fn send_verification_code(
        &self,
        email: &str,
        code: &str,
        email_type: &str,
    ) -> Result<()> {
        let subject = match email_type {
            "login_register" => "Your Capture login code",
            _ => "Verify your email address",
        };

        let html = match email_type {
            "login_register" => Self::get_login_code_template(code),
            _ => Self::get_verification_template(code),
        };

        let text = match email_type {
            "login_register" => format!(
                "Your Capture login code is: {}. This code expires in 10 minutes.",
                code
            ),
            _ => format!(
                "Your verification code is: {}. This code expires in 10 minutes.",
                code
            ),
        };

        let options = SendEmailOptions {
            to: email.to_string(),
            subject: subject.to_string(),
            html,
            text: Some(text),
        };

        self.send_email(options).await
    }

    fn get_login_code_template(code: &str) -> String {
        format!(
            r#"
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
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1C1C1C;">{}</span>
                  </div>
                  <p style="font-size: 14px; color: #999;">
                    This code expires in 10 minutes. If you didn't request this code, please ignore this email.
                  </p>
                </div>
              </body>
            </html>
            "#,
            code
        )
    }

    fn get_verification_template(code: &str) -> String {
        format!(
            r#"
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
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1C1C1C;">{}</span>
                  </div>
                  <p style="font-size: 14px; color: #999;">
                    This code expires in 10 minutes.
                  </p>
                </div>
              </body>
            </html>
            "#,
            code
        )
    }
}

pub fn create_email_service(env: &Env) -> Result<EmailService> {
    let resend_api_key = env
        .secret("RESEND_API_KEY")
        .map_err(|_| {
            worker::Error::RustError("RESEND_API_KEY not found in environment".to_string())
        })?
        .to_string();

    EmailService::new(resend_api_key)
}
