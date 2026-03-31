import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key_change_this";
const JWT_EXPIRY = "7d";

export interface DecodedToken {
  id: string;
  email: string;
  role: "user" | "rider" | "hotel" | "admin";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePasswords(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(
  id: string,
  email: string,
  role: "user" | "rider" | "hotel" | "admin"
): string {
  return jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): DecodedToken {
  return jwt.verify(token, JWT_SECRET) as DecodedToken;
}
