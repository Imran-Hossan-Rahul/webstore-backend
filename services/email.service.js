import nodemailer from "nodemailer";
import { CLIENT_URL } from "../config/index.js";
import logger from "../utils/logger.js";

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a professional verification email
 */
export const sendVerificationEmail = async (email, name, token, mode = "both") => {
  const verificationUrl = `${CLIENT_URL}/auth/verify-email?token=${token}`;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 24px;">
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="color: #0f172a; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; margin: 0;">IDENTITY AUTHENTICATION</h1>
        <p style="color: #64748b; font-size: 12px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; margin-top: 8px;">Security Protocol</p>
      </div>
      
      <div style="color: #334155; font-size: 16px; line-height: 1.6;">
        <p>Greetings, <strong>${name}</strong>,</p>
        <p>To finalize your account's high-trust status and enable full forensic authorization features, you must verify your communication endpoint.</p>
        
        ${mode === "both" ? `
        <p>You can enter the following 6-digit verification code in your settings:</p>
        <div style="text-align: center; margin: 32px 0;">
          <div style="background-color: #f1f5f9; border: 1px dashed #cbd5e1; padding: 20px; border-radius: 12px; display: inline-block;">
            <p style="margin: 0; font-size: 32px; font-family: monospace; font-weight: 800; letter-spacing: 0.25em; color: #0f172a;">${token}</p>
          </div>
        </div>
        <p style="text-align: center; margin-bottom: 24px;">Or alternatively, click the button below:</p>
        ` : ''}

        <div style="text-align: center; margin: ${mode === "both" ? '0 0 48px 0' : '48px 0'};">
          <a href="${verificationUrl}" style="background-color: #0f172a; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 600; letter-spacing: 0.1em; display: inline-block;">VERIFY ENDPOINT</a>
        </div>
        
        <p style="font-size: 13px; color: #64748b;">This ${mode === "both" ? "code and link" : "link"} will expire in 5 minutes. If you did not initiate this request, please ignore this transmission.</p>
      </div>
      
      <div style="margin-top: 60px; padding-top: 24px; border-top: 1px solid #f1f5f9; text-align: center;">
        <p style="font-size: 11px; color: #94a3b8; letter-spacing: 0.05em; line-height: 1.5;">
          © ${new Date().getFullYear()} Enterprise Systems. All rights reserved.<br/>
          Secured with AES-256 Encryption.
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Security Center" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Action Required: Verify Your Endpoint",
      html: html,
    });
    logger.info(`Verification email dispatched to: ${email}`);
  } catch (error) {
    logger.error("Email Dispatch Failure:", error);
    throw new Error("Failed to send verification email");
  }
};

/**
 * Send email change verification code
 */
export const sendEmailChangeVerification = async (email, name, token) => {
  const verificationUrl = `${CLIENT_URL}/auth/verify-email-change?token=${token}`;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 24px;">
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="color: #0f172a; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; margin: 0;">EMAIL CHANGE PROTOCOL</h1>
        <p style="color: #64748b; font-size: 12px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; margin-top: 8px;">Security Authorization</p>
      </div>
      
      <div style="color: #334155; font-size: 16px; line-height: 1.6;">
        <p>Greetings, <strong>${name}</strong>,</p>
        <p>A request has been initiated to update the primary communication endpoint for your account to this address. To authorize this change, please confirm your identity below.</p>
        
        <div style="text-align: center; margin: 48px 0;">
          <a href="${verificationUrl}" style="background-color: #0f172a; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 600; letter-spacing: 0.1em; display: inline-block;">AUTHORIZE CHANGE</a>
        </div>
        
        <p style="font-size: 13px; color: #64748b;">This authorization link will expire in 24 hours. If you did not request this change, please ignore this transmission; your current email remains secure.</p>
      </div>
      
      <div style="margin-top: 60px; padding-top: 24px; border-top: 1px solid #f1f5f9; text-align: center;">
        <p style="font-size: 11px; color: #94a3b8; letter-spacing: 0.05em; line-height: 1.5;">
          © ${new Date().getFullYear()} Enterprise Systems. All rights reserved.<br/>
          Secured with AES-256 Encryption.
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Security Center" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Action Required: Authorize Email Change",
      html: html,
    });
    logger.info(`Email change verification dispatched to: ${email}`);
  } catch (error) {
    logger.error("Email Change Dispatch Failure:", error);
    throw new Error("Failed to send email change verification");
  }
};

/**
 * Send a generic event notification email.
 * Called by notificationHelper when a user has email preferences enabled.
 *
 * @param {string} toEmail     - Recipient email address
 * @param {string} toName      - Recipient display name (unused in body – for logging)
 * @param {object} payload     - { subject: string, bodyHtml: string }
 */
export const sendEventEmail = async (toEmail, toName, { subject, bodyHtml }) => {
  try {
    await transporter.sendMail({
      from: `"Platform Notifications" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      html: bodyHtml,
    });
    logger.info(`Event email dispatched to: ${toEmail} | subject: ${subject}`);
  } catch (error) {
    logger.error(`Event email failed to ${toEmail}:`, error);
    throw error; // re-throw so caller can catch silently
  }
};

/**
 * Send password reset link email
 */
export const sendPasswordResetEmail = async (email, name, token) => {
  const resetUrl = `${CLIENT_URL}/auth/reset-password?token=${token}`;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 24px;">
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="color: #0f172a; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; margin: 0;">PASSWORD RESET PROTOCOL</h1>
        <p style="color: #64748b; font-size: 12px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; margin-top: 8px;">Security Override</p>
      </div>
      
      <div style="color: #334155; font-size: 16px; line-height: 1.6;">
        <p>Greetings, <strong>${name}</strong>,</p>
        <p>A password reset sequence has been initiated for your enterprise credentials. To authorize this security override and configure a new credential set, proceed via the link below.</p>
        
        <div style="text-align: center; margin: 48px 0;">
          <a href="${resetUrl}" style="background-color: #0f172a; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 600; letter-spacing: 0.1em; display: inline-block;">RESET CREDENTIALS</a>
        </div>
        
        <p style="font-size: 13px; color: #64748b;">This security token and override window will self-expire in 60 minutes. If you did not authorize this change sequence, please alert security immediately; your account remains locked under regular guard.</p>
      </div>
      
      <div style="margin-top: 60px; padding-top: 24px; border-top: 1px solid #f1f5f9; text-align: center;">
        <p style="font-size: 11px; color: #94a3b8; letter-spacing: 0.05em; line-height: 1.5;">
          © ${new Date().getFullYear()} Enterprise Systems. All rights reserved.<br/>
          Secured with AES-256 Encryption.
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Security Center" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Action Required: Reset Credentials",
      html: html,
    });
    logger.info(`Password reset email dispatched to: ${email}`);
  } catch (error) {
    logger.error("Password Reset Dispatch Failure:", error);
    throw new Error("Failed to send password reset email");
  }
};

