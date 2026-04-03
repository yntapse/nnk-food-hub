import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";

// ── Hoisted mocks (resolved before any imports) ─────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    $connect: vi.fn(() => Promise.resolve()),
    admin: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    hotel: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    rider: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    menuItem: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    order: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock("../db", () => ({ prisma: mockPrisma }));
vi.mock("../seed", () => ({ seedDB: vi.fn(() => Promise.resolve()) }));
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn((text: string) => Promise.resolve(`$hashed$${text}`)),
    compare: vi.fn((plain: string, hash: string) => Promise.resolve(hash === `$hashed$${plain}`)),
  },
}));

// Import after mocks are registered
import { createServer } from "../index";

const waitTick = () => new Promise<void>((r) => setTimeout(r, 50));

let app: Express;

async function requestSignupOtp(phone: string) {
  const res = await request(app).post("/api/auth/send-otp").send({ phone });
  expect(res.status).toBe(200);
  expect(res.body.otp).toMatch(/^\d{6}$/);
  return res.body.otp as string;
}

beforeAll(async () => {
  const { app: a } = createServer();
  app = a;
  await waitTick();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$connect.mockResolvedValue(undefined);
  mockPrisma.admin.findUnique.mockResolvedValue({ id: 1, email: "admin@foodhub.local" });
});

// ── SIGNUP ───────────────────────────────────────────────────────────────────
describe("POST /api/auth/signup", () => {
  it("creates a new user and returns a JWT token", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 42, email: "alice@test.com", name: "Alice", phone: "9999999999",
    });
    const otp = await requestSignupOtp("9999999999");

    const res = await request(app).post("/api/auth/signup").send({
      email: "alice@test.com", password: "Password@1", name: "Alice",
      phone: "9999999999", role: "user", otp,
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe("alice@test.com");
    expect(res.body.user.role).toBe("user");
  });

  it("returns 400 when user signup OTP is missing", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "alice@test.com", password: "Password@1", name: "Alice",
      phone: "9999999999", role: "user",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/otp is required/i);
  });

  it("rejects hotel self-signup with 403", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "hotel@test.com", password: "pw", name: "H", phone: "0", role: "hotel",
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });

  it("rejects rider self-signup with 403", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "rider@test.com", password: "pw", name: "R", phone: "0", role: "rider",
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });

  it("returns 400 for invalid role", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "x@test.com", password: "pw", name: "X", phone: "0", role: "superuser",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "x@test.com", role: "user",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing/i);
  });

  it("returns 400 for duplicate email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, email: "dup@test.com" });
    const otp = await requestSignupOtp("9999999999");

    const res = await request(app).post("/api/auth/signup").send({
      email: "dup@test.com", password: "pw", name: "D", phone: "9999999999", role: "user", otp,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

// ── LOGIN ────────────────────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  it("logs in a user and returns JWT", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1, email: "ravi@test.com", name: "Ravi", password: "$hashed$MyPass@1",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "ravi@test.com", password: "MyPass@1", role: "user",
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.role).toBe("user");
  });

  it("logs in a hotel account", async () => {
    mockPrisma.hotel.findUnique.mockResolvedValue({
      id: 5, email: "biryani@test.com", name: "Biryani House", password: "$hashed$Hotel@123",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "biryani@test.com", password: "Hotel@123", role: "hotel",
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("hotel");
  });

  it("logs in a rider account", async () => {
    mockPrisma.rider.findUnique.mockResolvedValue({
      id: 3, email: "aman@test.com", name: "Aman", password: "$hashed$Rider@123",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "aman@test.com", password: "Rider@123", role: "rider",
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("rider");
  });

  it("logs in an admin account", async () => {
    mockPrisma.admin.findUnique.mockResolvedValue({
      id: 1, email: "admin@foodhub.local", name: "Super Admin", password: "$hashed$Admin@123",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "admin@foodhub.local", password: "Admin@123", role: "admin",
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("admin");
  });

  it("returns 401 for wrong password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1, email: "ravi@test.com", name: "Ravi", password: "$hashed$CorrectPass",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "ravi@test.com", password: "WrongPass", role: "user",
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("returns 401 for non-existent user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/login").send({
      email: "ghost@test.com", password: "pw", role: "user",
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing fields", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "x@x.com" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid role", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "x@x.com", password: "pw", role: "unknown",
    });
    expect(res.status).toBe(400);
  });
});
