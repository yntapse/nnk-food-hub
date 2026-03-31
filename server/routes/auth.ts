import { RequestHandler } from "express";
import { prisma } from "../db";
import {
  hashPassword,
  comparePasswords,
  generateToken,
} from "../utils/auth";

export const signup: RequestHandler = async (req, res) => {
  try {
    const { email, password, name, phone, role, address, location, category } =
      req.body;

    if (!email || !password || !name || !phone || !role) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const hashedPassword = await hashPassword(password);
    let id: number;

    if (role === "user") {
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
