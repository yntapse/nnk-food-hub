import { RequestHandler } from "express";
import { prisma } from "../db";
import {
  hashPassword,
  comparePasswords,
  generateToken,
} from "../utils/auth";

type OtpProvider = "local" | "twilio";

// In-memory OTP store: cleanPhone -> provider metadata
const otpStore = new Map<string, { otp: string; expires: number; provider: OtpProvider }>();

function cleanPhone(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^91/, "").slice(-10);
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
    const { email, password, name, phone, role, address, location, category, otp } =
      req.body;

    if (!email || !password || !name || !phone || !role) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const hashedPassword = await hashPassword(password);
    let id: number;

    if (role === "user") {
      // Verify phone OTP before creating account
      if (!otp) {
        res.status(400).json({ error: "OTP is required. Please verify your phone number." });
        return;
      }
      const digits = cleanPhone(String(phone));
      const stored = otpStore.get(digits);
      if (!stored) {
        res.status(400).json({ error: "OTP not found. Please request a new OTP." });
        return;
      }
      if (Date.now() > stored.expires) {
        otpStore.delete(digits);
        res.status(400).json({ error: "OTP expired. Please request a new OTP." });
        return;
      }

      if (stored.provider === "twilio") {
        const verified = await verifyTwilioOtp(formatIndianPhone(phone), String(otp).trim());
        if (!verified.ok) {
          res.status(400).json({ error: verified.reason ?? "Invalid OTP. Please check and try again." });
          return;
        }
      } else {
        if (stored.otp !== String(otp).trim()) {
          res.status(400).json({ error: "Invalid OTP. Please check and try again." });
          return;
        }
      }

      otpStore.delete(digits); // single-use

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) { res.status(400).json({ error: "User already exists" }); return; }
      const user = await prisma.user.create({
        data: { email, password: hashedPassword, name, phone, address: address || "" },
      });
      id = user.id;
    } else if (role === "rider") {
      res.status(403).json({ error: "Rider accounts can only be created by admin" });
      return;
    } else if (role === "hotel") {
      res.status(403).json({ error: "Restaurant accounts can only be created by admin" });
      return;
    } else {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    const token = generateToken(String(id), email, role);
    res.status(201).json({
      message: "Signup successful",
      token,
      user: { id, email, name, role },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Signup failed" });
  }
};

export const login: RequestHandler = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      res.status(400).json({ error: "Missing email, password, or role" });
      return;
    }

    let user: { id: number; email: string; name: string; password: string } | null = null;

    if (role === "user") {
      user = await prisma.user.findUnique({ where: { email } });
    } else if (role === "rider") {
      user = await prisma.rider.findUnique({ where: { email } });
    } else if (role === "hotel") {
      user = await prisma.hotel.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, password: true },
      });
    } else if (role === "admin") {
      user = await prisma.admin.findUnique({ where: { email } });
    } else {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const isPasswordValid = await comparePasswords(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = generateToken(String(user.id), email, role);
    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, email, name: user.name || "Admin", role },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};
