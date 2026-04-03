import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = "your_super_secret_jwt_key_change_this_in_production";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    $connect: vi.fn(() => Promise.resolve()),
    admin: { findFirst: vi.fn(), findUnique: vi.fn() },
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
vi.mock("../utils/rider-assignment", () => ({
  autoAssignRider: vi.fn(() => Promise.resolve(null)),
  queueOrderForLaterAssignment: vi.fn(() => Promise.resolve()),
  assignPendingOrders: vi.fn(() => Promise.resolve()),
}));

import { createServer } from "../index";
import { assignPendingOrders } from "../utils/rider-assignment";

const waitTick = () => new Promise<void>((r) => setTimeout(r, 50));

const makeToken = (id: number, role: string) =>
  `Bearer ${jwt.sign({ id: String(id), email: `${role}@test.com`, role }, JWT_SECRET, { expiresIn: "7d" })}`;

const RIDER_TOKEN = makeToken(3, "rider");
const RIDER_ID = 3;

let app: Express;

beforeAll(async () => {
  const { app: a } = createServer();
  app = a;
  await waitTick();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$connect.mockResolvedValue(undefined);
});

// ── RIDER PROFILE ────────────────────────────────────────────────────────────
describe("GET /api/rider/profile", () => {
  it("returns the rider's own profile", async () => {
    mockPrisma.rider.findUnique.mockResolvedValue({
      id: RIDER_ID, name: "Aman Rider", email: "aman@test.com",
      isOnline: true, isAvailable: true, totalEarnings: 500, orders: [],
    });

    const res = await request(app)
      .get("/api/rider/profile")
      .set("Authorization", RIDER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Aman Rider");
    expect(res.body.isOnline).toBe(true);
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/rider/profile");
    expect(res.status).toBe(401);
  });
});

// ── RIDER STATUS ─────────────────────────────────────────────────────────────
describe("PUT /api/rider/status", () => {
  it("sets rider online (isOnline: true → isAvailable: true)", async () => {
    mockPrisma.rider.update.mockResolvedValue({
      id: RIDER_ID, isOnline: true, isAvailable: true,
    });

    const res = await request(app)
      .put("/api/rider/status")
      .set("Authorization", RIDER_TOKEN)
      .send({ isOnline: true });

    expect(res.status).toBe(200);
    expect(res.body.rider.isOnline).toBe(true);
    expect(res.body.rider.isAvailable).toBe(true);
  });

  it("sets rider offline (isOnline: false → isAvailable: false)", async () => {
    mockPrisma.rider.update.mockResolvedValue({
      id: RIDER_ID, isOnline: false, isAvailable: false,
    });

    const res = await request(app)
      .put("/api/rider/status")
      .set("Authorization", RIDER_TOKEN)
      .send({ isOnline: false });

    expect(res.status).toBe(200);
    expect(res.body.rider.isOnline).toBe(false);
    expect(res.body.rider.isAvailable).toBe(false);
  });
});

// ── RIDER AVAILABILITY ───────────────────────────────────────────────────────
describe("PUT /api/rider/availability", () => {
  it("marks rider as temporarily unavailable", async () => {
    mockPrisma.rider.update.mockResolvedValue({
      id: RIDER_ID, isOnline: true, isAvailable: false,
    });

    const res = await request(app)
      .put("/api/rider/availability")
      .set("Authorization", RIDER_TOKEN)
      .send({ isAvailable: false });

    expect(res.status).toBe(200);
    expect(res.body.rider.isAvailable).toBe(false);
  });
});

// ── ACCEPT DELIVERY ──────────────────────────────────────────────────────────
describe("POST /api/rider/accept/:orderId", () => {
  it("accepts a delivery and marks rider unavailable", async () => {
    mockPrisma.order.update.mockResolvedValue({
      id: 1, riderId: RIDER_ID, status: "Out for Delivery", userId: 10,
    });
    mockPrisma.rider.update.mockResolvedValue({ id: RIDER_ID, isAvailable: false });

    const res = await request(app)
      .post("/api/rider/accept/1")
      .set("Authorization", RIDER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("Out for Delivery");
    expect(res.body.order.riderId).toBe(RIDER_ID);
  });
});

// ── COMPLETE DELIVERY ────────────────────────────────────────────────────────
describe("POST /api/rider/complete/:orderId", () => {
  it("completes delivery and credits 10% of totalPrice as earnings", async () => {
    const totalPrice = 200;
    const expectedEarning = Math.round(totalPrice * 0.1); // 20
    const correctOtp = "4321";

    // findUnique is called first to check OTP
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 1, deliveryOtp: correctOtp, totalPrice, userId: 10,
    });
    mockPrisma.order.update.mockResolvedValue({
      id: 1, status: "Delivered", totalPrice, userId: 10, riderId: RIDER_ID,
    });
    mockPrisma.rider.update.mockResolvedValue({ id: RIDER_ID, totalEarnings: 520, isAvailable: true });
    mockPrisma.order.count.mockResolvedValue(0); // no more active orders

    const res = await request(app)
      .post("/api/rider/complete/1")
      .set("Authorization", RIDER_TOKEN)
      .send({ otp: correctOtp });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("Delivered");

    // After delivery, active order count is 0 → rider becomes available + assignPendingOrders is called
    expect(mockPrisma.rider.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalEarnings: { increment: expectedEarning } }) })
    );
    expect(assignPendingOrders).toHaveBeenCalledWith(RIDER_ID);
  });

  it("returns 400 when OTP is missing", async () => {
    const res = await request(app)
      .post("/api/rider/complete/1")
      .set("Authorization", RIDER_TOKEN)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/otp/i);
  });

  it("returns 400 when OTP is wrong", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 1, deliveryOtp: "1234", totalPrice: 200, userId: 10,
    });

    const res = await request(app)
      .post("/api/rider/complete/1")
      .set("Authorization", RIDER_TOKEN)
      .send({ otp: "9999" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid otp/i);
  });
});

// ── RIDER EARNINGS ───────────────────────────────────────────────────────────
describe("GET /api/rider/earnings", () => {
  it("returns total earnings, completed and active deliveries", async () => {
    mockPrisma.rider.findUnique.mockResolvedValue({ totalEarnings: 1500 });
    mockPrisma.order.count
      .mockResolvedValueOnce(30)  // completed orders
      .mockResolvedValueOnce(1);  // active orders

    const res = await request(app)
      .get("/api/rider/earnings")
      .set("Authorization", RIDER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.totalEarnings).toBe(1500);
    expect(res.body.completedDeliveries).toBe(30);
    expect(res.body.activeDeliveries).toBe(1);
  });
});

// ── RIDER ORDERS ─────────────────────────────────────────────────────────────
describe("GET /api/rider/orders", () => {
  it("returns orders assigned to this rider and unassigned Ready orders", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: 1, status: "Out for Delivery", riderId: RIDER_ID,
        hotel: { name: "Biryani House", location: "Downtown" },
        user: { name: "Ravi", phone: "9999999999", address: "123 Main" },
      },
      {
        id: 2, status: "Ready", riderId: null,
        hotel: { name: "Pizza Point", location: "City" },
        user: { name: "Priya", phone: "8888888888", address: "456 Park" },
      },
    ]);

    const res = await request(app)
      .get("/api/rider/orders")
      .set("Authorization", RIDER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].status).toBe("Out for Delivery");
    expect(res.body[1].status).toBe("Ready");
  });
});
