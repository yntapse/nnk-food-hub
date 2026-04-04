import { RequestHandler } from "express";
import { prisma } from "../db";
import {
  hashPassword,
  comparePasswords,
  generateToken,
} from "../utils/auth";

type OtpProvider = "local" | "twilio";

// In-memory OTP store: cleanPhone -> provider metadata (still used for phone-based sendOtp for other flows)
const otpStore = new Map<string, { otp: string; expires: number; provider: OtpProvider }>();

// In-memory OTP store for email-based password reset: email -> { otp, expires }
const emailOtpStore = new Map<string, { otp: string; expires: number }>();

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;
  if (!host || !user || !pass) return null;
  return { host, port, user, pass, from };
}

async function sendEmailOtp(toEmail: string, otp: string): Promise<{ ok: boolean; reason?: string }> {
  const cfg = getSmtpConfig();
  if (!cfg) {
    // Dev-mode: no SMTP configured, caller will return OTP in response
    return { ok: false, reason: "SMTP not configured" };
  }
  try {
    // Dynamically import nodemailer so the server still starts without it
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({
      from: `"Niphad Bites" <${cfg.from}>`,
      to: toEmail,
      subject: "Your OTP for Niphad Bites",
      text: `Your OTP is: ${otp}\nIt expires in 10 minutes.`,
      html: `<p>Your OTP is: <strong style="font-size:1.5em;letter-spacing:0.2em">${otp}</strong></p><p>It expires in 10 minutes.</p>`,
    });
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Email send failed";
    return { ok: false, reason };
  }
}

function cleanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Strip country code 91 only when the number is longer than 10 digits
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(2);
  return digits.slice(-10);
}

function formatIndianPhone(raw: string): string {
  return `+91${cleanPhone(raw)}`;
}

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    return null;
  }

  return { accountSid, authToken, serviceSid };
}

async function sendTwilioOtp(phone: string) {
  const config = getTwilioConfig();
  if (!config) {
    return { ok: false as const, reason: "Twilio Verify is not configured" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const authHeader = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
    const body = new URLSearchParams({ To: phone, Channel: "sms" });
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${config.serviceSid}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: controller.signal,
      },
    );

    const data = (await response.json().catch(() => ({}))) as {
      status?: string;
      message?: string;
      code?: number;
    };

    if (!response.ok) {
      return {
        ok: false as const,
        reason: data.message ?? `Twilio Verify request failed with ${response.status}`,
      };
    }

    return { ok: true as const, status: data.status ?? "pending" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Twilio error";
    return { ok: false as const, reason: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function verifyTwilioOtp(phone: string, otp: string) {
  const config = getTwilioConfig();
  if (!config) {
    return { ok: false as const, reason: "Twilio Verify is not configured" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const authHeader = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
    const body = new URLSearchParams({ To: phone, Code: otp });
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${config.serviceSid}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: controller.signal,
      },
    );

    const data = (await response.json().catch(() => ({}))) as {
      status?: string;
      valid?: boolean;
      message?: string;
    };

    if (!response.ok) {
      return {
        ok: false as const,
        reason: data.message ?? `Twilio Verify check failed with ${response.status}`,
      };
    }

    return { ok: data.status === "approved" || data.valid === true, reason: data.message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Twilio error";
    return { ok: false as const, reason: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const sendOtp: RequestHandler = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json({ error: "Phone number is required" });
      return;
    }

    const digits = cleanPhone(String(phone));
    if (digits.length !== 10) {
      res.status(400).json({ error: "Enter a valid 10-digit phone number" });
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000;
    const twilioPhone = formatIndianPhone(phone);
    const twilioResult = await sendTwilioOtp(twilioPhone);

    if (twilioResult.ok) {
      otpStore.set(digits, { otp: "", expires, provider: "twilio" });
      res.json({ message: "OTP sent to your phone number" });
      return;
    }

    otpStore.set(digits, { otp, expires, provider: "local" });
    console.error("Twilio Verify send failed:", twilioResult.reason);
    res.json({
      message: `SMS not sent (Twilio Verify: ${twilioResult.reason}). Use this OTP for testing.`,
      otp,
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
};

export const signup: RequestHandler = async (req, res) => {
  try {
    const { email, password, name, phone, role, address } = req.body;

    if (!email || !password || !name || !phone || !role) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    if (role === "rider") {
      res.status(403).json({ error: "Rider accounts can only be created by admin" });
      return;
    }
    if (role === "hotel") {
      res.status(403).json({ error: "Restaurant accounts can only be created by admin" });
      return;
    }
    if (role !== "user") {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { res.status(400).json({ error: "User already exists" }); return; }

    const digits = cleanPhone(String(phone));
    if (digits.length !== 10) {
      res.status(400).json({ error: "Enter a valid 10-digit phone number" });
      return;
    }
    const phoneExists = await prisma.user.findFirst({ where: { phone: { endsWith: digits } } });
    if (phoneExists) { res.status(400).json({ error: "This phone number is already registered" }); return; }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, phone, address: address || "" },
    });

    const token = generateToken(String(user.id), email, role);
    res.status(201).json({
      message: "Signup successful",
      token,
      user: { id: user.id, email, name, role },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Signup failed" });
  }
};

export const forgotPassword: RequestHandler = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: "Email address is required" }); return; }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Look up account across all role tables
    const userRecord =
      await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true, email: true } }) ??
      await prisma.rider.findFirst({ where: { email: normalizedEmail }, select: { id: true, email: true } }) ??
      await prisma.hotel.findFirst({ where: { email: normalizedEmail }, select: { id: true, email: true } }) ??
      await prisma.admin.findUnique({ where: { email: normalizedEmail }, select: { id: true, email: true } });

    // Always return same message to prevent email enumeration
    if (!userRecord) {
      res.json({ message: "If this email is registered, an OTP has been sent to it." });
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000;
    emailOtpStore.set(normalizedEmail, { otp, expires });

    const emailResult = await sendEmailOtp(normalizedEmail, otp);
    if (emailResult.ok) {
      res.json({ message: "OTP sent to your email address." });
      return;
    }

    // Dev-mode fallback: return OTP in response
    console.error("Email OTP send failed:", emailResult.reason);
    res.json({
      message: `Email not sent (${emailResult.reason}). Use this OTP for testing.`,
      otp,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
};

export const resetPassword: RequestHandler = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      res.status(400).json({ error: "Email, OTP and new password are required" });
      return;
    }
    if (String(newPassword).length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const stored = emailOtpStore.get(normalizedEmail);
    if (!stored) { res.status(400).json({ error: "OTP not found. Please request a new OTP." }); return; }
    if (Date.now() > stored.expires) {
      emailOtpStore.delete(normalizedEmail);
      res.status(400).json({ error: "OTP expired. Please request a new OTP." });
      return;
    }
    if (stored.otp !== String(otp).trim()) {
      res.status(400).json({ error: "Invalid OTP. Please check and try again." });
      return;
    }

    emailOtpStore.delete(normalizedEmail); // single-use

    const hashed = await hashPassword(String(newPassword));

    // Update password in whichever table the account lives in
    const inUser = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
    if (inUser) { await prisma.user.update({ where: { id: inUser.id }, data: { password: hashed } }); }
    else {
      const inRider = await prisma.rider.findFirst({ where: { email: normalizedEmail }, select: { id: true } });
      if (inRider) { await prisma.rider.update({ where: { id: inRider.id }, data: { password: hashed } }); }
      else {
        const inHotel = await prisma.hotel.findFirst({ where: { email: normalizedEmail }, select: { id: true } });
        if (inHotel) { await prisma.hotel.update({ where: { id: inHotel.id }, data: { password: hashed } }); }
        else {
          const inAdmin = await prisma.admin.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
          if (inAdmin) { await prisma.admin.update({ where: { id: inAdmin.id }, data: { password: hashed } }); }
          else { res.status(400).json({ error: "Account not found" }); return; }
        }
      }
    }

    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
};

export const login: RequestHandler = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      res.status(400).json({ error: "Phone number / email and password are required" });
      return;
    }

    const id = String(identifier).trim();
    const isEmail = id.includes("@");

    type Match = { id: number; email: string; name: string; password: string };
    let user: Match | null = null;
    let role: string = "";

    if (isEmail) {
      // Email path: admin → user → rider → hotel
      const admin = await prisma.admin.findUnique({ where: { email: id } });
      if (admin) { user = admin; role = "admin"; }

      if (!user) {
        const u = await prisma.user.findUnique({ where: { email: id } });
        if (u) { user = u; role = "user"; }
      }
      if (!user) {
        const r = await prisma.rider.findFirst({ where: { email: id } });
        if (r) { user = r; role = "rider"; }
      }
      if (!user) {
        const h = await prisma.hotel.findFirst({
          where: { email: id },
          select: { id: true, email: true, name: true, password: true },
        });
        if (h) { user = h; role = "hotel"; }
      }
    } else {
      // Phone path: user → rider → hotel
      const digits = cleanPhone(id);
      if (digits.length !== 10) {
        res.status(400).json({ error: "Enter a valid 10-digit phone number" });
        return;
      }

      const u = await prisma.user.findFirst({ where: { phone: { endsWith: digits } } });
      if (u) { user = u; role = "user"; }

      if (!user) {
        const r = await prisma.rider.findFirst({ where: { phone: { endsWith: digits } } });
        if (r) { user = r; role = "rider"; }
      }
      if (!user) {
        const h = await prisma.hotel.findFirst({
          where: { phone: { endsWith: digits } },
          select: { id: true, email: true, name: true, password: true },
        });
        if (h) { user = h; role = "hotel"; }
      }
    }

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const isPasswordValid = await comparePasswords(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = generateToken(String(user.id), user.email, role as "user" | "rider" | "hotel" | "admin");
    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email, name: user.name || "Admin", role },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};
