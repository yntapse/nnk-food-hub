import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = "your_super_secret_jwt_key_change_this_in_production";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    $connect: vi.fn(() => Promise.resolve()),
    admin: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    hotel: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
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

import { createServer } from "../index";

const waitTick = () => new Promise<void>((r) => setTimeout(r, 50));

const makeToken = (id: number, role: string) =>
  `Bearer ${jwt.sign({ id: String(id), email: `${role}@test.com`, role }, JWT_SECRET, { expiresIn: "7d" })}`;

const ADMIN_TOKEN = makeToken(1, "admin");
const USER_TOKEN = makeToken(10, "user");

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

// ── PUBLIC ADMIN ENDPOINTS ───────────────────────────────────────────────────
describe("GET /api/admin/upi (public)", () => {
  it("returns admin UPI and name without auth", async () => {
    mockPrisma.admin.findFirst.mockResolvedValue({ upiId: "admin@upi", name: "Super Admin" });

    const res = await request(app).get("/api/admin/upi");
    expect(res.status).toBe(200);
    expect(res.body.upiId).toBe("admin@upi");
    expect(res.body.name).toBe("Super Admin");
  });

  it("returns empty strings when no admin record exists", async () => {
    mockPrisma.admin.findFirst.mockResolvedValue(null);

    const res = await request(app).get("/api/admin/upi");
    expect(res.status).toBe(200);
    expect(res.body.upiId).toBe("");
  });
});

describe("GET /api/admin/delivery-settings (public)", () => {
  it("returns delivery fee settings without auth", async () => {
    mockPrisma.admin.findFirst.mockResolvedValue({
      deliveryFeeAmount: 30, freeDeliveryThreshold: 200, firstOrderFree: true,
    });

    const res = await request(app).get("/api/admin/delivery-settings");
    expect(res.status).toBe(200);
    expect(res.body.deliveryFeeAmount).toBe(30);
    expect(res.body.freeDeliveryThreshold).toBe(200);
    expect(res.body.firstOrderFree).toBe(true);
  });

  it("returns defaults when no admin row exists", async () => {
    mockPrisma.admin.findFirst.mockResolvedValue(null);

    const res = await request(app).get("/api/admin/delivery-settings");
    expect(res.status).toBe(200);
    expect(res.body.deliveryFeeAmount).toBe(30);
    expect(res.body.firstOrderFree).toBe(true);
  });
});

// ── ANALYTICS ────────────────────────────────────────────────────────────────
describe("GET /api/admin/analytics", () => {
  it("returns platform statistics", async () => {
    mockPrisma.user.count.mockResolvedValue(50);
    mockPrisma.rider.count
      .mockResolvedValueOnce(10)  // totalRiders
      .mockResolvedValueOnce(4);  // onlineRiders
    mockPrisma.hotel.count.mockResolvedValue(8);
    mockPrisma.order.count
      .mockResolvedValueOnce(200) // totalOrders
      .mockResolvedValueOnce(150); // deliveredOrders
    mockPrisma.order.aggregate.mockResolvedValue({ _sum: { deliveryFee: 4500 } });

    const res = await request(app)
      .get("/api/admin/analytics")
      .set("Authorization", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBe(50);
    expect(res.body.totalRevenue).toBe(4500);
    expect(res.body.totalOrders).toBe(200);
  });

  it("returns 401/403 for non-admin user", async () => {
    const res = await request(app)
      .get("/api/admin/analytics")
      .set("Authorization", USER_TOKEN);

    expect([401, 403]).toContain(res.status);
  });
});

// ── HOTEL MANAGEMENT ─────────────────────────────────────────────────────────
describe("GET /api/admin/hotels", () => {
  it("returns all hotels with rating field", async () => {
    mockPrisma.hotel.findMany.mockResolvedValue([
      { id: 1, name: "Biryani House", rating: 4.5, isOpen: true },
      { id: 2, name: "Pizza Point", rating: 3.2, isOpen: false },
    ]);

    const res = await request(app)
      .get("/api/admin/hotels")
      .set("Authorization", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].rating).toBe(4.5);
  });
});

describe("POST /api/admin/hotels", () => {
  it("creates a hotel with admin-set rating", async () => {
    mockPrisma.hotel.findUnique.mockResolvedValue(null);
    mockPrisma.hotel.create.mockResolvedValue({
      id: 10, name: "New Hotel", email: "new@hotel.com", rating: 4.2,
    });

    const res = await request(app)
      .post("/api/admin/hotels")
      .set("Authorization", ADMIN_TOKEN)
      .send({
        name: "New Hotel", email: "new@hotel.com", phone: "9000000001",
        password: "Hotel@123", location: "MG Road", category: "Indian",
        rating: 4.2,
      });

    expect(res.status).toBe(201);
    expect(res.body.hotel.rating).toBe(4.2);
  });

  it("returns 400 if hotel email already exists", async () => {
    mockPrisma.hotel.findUnique.mockResolvedValue({ id: 1, email: "existing@hotel.com" });

    const res = await request(app)
      .post("/api/admin/hotels")
      .set("Authorization", ADMIN_TOKEN)
      .send({
        name: "Dupe Hotel", email: "existing@hotel.com", phone: "9000000002",
        password: "Hotel@123", location: "Town", category: "Fast Food",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

describe("PUT /api/admin/hotels/:hotelId", () => {
  it("updates hotel rating (admin-only field)", async () => {
    mockPrisma.hotel.update.mockResolvedValue({
      id: 1, name: "Biryani House", rating: 3.8, isOpen: true,
    });

    const res = await request(app)
      .put("/api/admin/hotels/1")
      .set("Authorization", ADMIN_TOKEN)
      .send({ rating: 3.8 });

    expect(res.status).toBe(200);
    expect(res.body.hotel.rating).toBe(3.8);
  });
});

describe("PATCH /api/admin/hotels/:hotelId/toggle", () => {
  it("toggles a hotel open/closed", async () => {
    mockPrisma.hotel.findUnique.mockResolvedValue({ id: 1, isOpen: true });
    mockPrisma.hotel.update.mockResolvedValue({ id: 1, isOpen: false });

    const res = await request(app)
      .patch("/api/admin/hotels/1/toggle")
      .set("Authorization", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.isOpen).toBe(false);
  });
});

describe("DELETE /api/admin/hotels/:hotelId", () => {
  it("deletes a hotel", async () => {
    mockPrisma.hotel.delete.mockResolvedValue({ id: 1 });

    const res = await request(app)
      .delete("/api/admin/hotels/1")
      .set("Authorization", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });
});

// ── RIDER MANAGEMENT ─────────────────────────────────────────────────────────
describe("POST /api/admin/riders", () => {
  it("creates a rider account", async () => {
    mockPrisma.rider.findUnique.mockResolvedValue(null);
    mockPrisma.rider.create.mockResolvedValue({
      id: 3, name: "Aman Rider", email: "aman@rider.com", phone: "9000000003",
    });

    const res = await request(app)
      .post("/api/admin/riders")
      .set("Authorization", ADMIN_TOKEN)
      .send({ name: "Aman Rider", email: "aman@rider.com", phone: "9000000003", password: "Rider@123" });

    expect(res.status).toBe(201);
    expect(res.body.rider.name).toBe("Aman Rider");
  });
});

describe("PUT /api/admin/riders/:riderId", () => {
  it("updates rider info", async () => {
    mockPrisma.rider.update.mockResolvedValue({
      id: 3, name: "Aman Updated", email: "aman@rider.com", phone: "9000000099",
    });

    const res = await request(app)
      .put("/api/admin/riders/3")
      .set("Authorization", ADMIN_TOKEN)
      .send({ name: "Aman Updated", phone: "9000000099" });

    expect(res.status).toBe(200);
    expect(res.body.rider.name).toBe("Aman Updated");
  });
});

// ── DELIVERY SETTINGS (ADMIN AUTH) ───────────────────────────────────────────
describe("PUT /api/admin/delivery-settings", () => {
  it("updates delivery fee, threshold, and firstOrderFree", async () => {
    mockPrisma.admin.update.mockResolvedValue({
      deliveryFeeAmount: 40,
      freeDeliveryThreshold: 300,
      firstOrderFree: false,
    });

    const res = await request(app)
      .put("/api/admin/delivery-settings")
      .set("Authorization", ADMIN_TOKEN)
      .send({ deliveryFeeAmount: 40, freeDeliveryThreshold: 300, firstOrderFree: false });

    expect(res.status).toBe(200);
    expect(res.body.settings.deliveryFeeAmount).toBe(40);
    expect(res.body.settings.freeDeliveryThreshold).toBe(300);
    expect(res.body.settings.firstOrderFree).toBe(false);
  });

  it("rejects non-admin users", async () => {
    const res = await request(app)
      .put("/api/admin/delivery-settings")
      .set("Authorization", USER_TOKEN)
      .send({ deliveryFeeAmount: 50 });

    expect([401, 403]).toContain(res.status);
  });
});

// ── ORDER MANAGEMENT ─────────────────────────────────────────────────────────
describe("GET /api/admin/orders", () => {
  it("returns all orders with user, hotel, rider details", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: 1, status: "Delivered", totalPrice: 180,
        user: { name: "Ravi", phone: "9999999999" },
        hotel: { name: "Biryani House", location: "Downtown" },
        rider: { name: "Aman", phone: "8888888888" },
      },
    ]);

    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body[0].user.name).toBe("Ravi");
    expect(res.body[0].hotel.name).toBe("Biryani House");
  });
});

describe("POST /api/admin/orders/:orderId/assign-rider", () => {
  it("assigns a rider to an order", async () => {
    mockPrisma.order.update.mockResolvedValue({ id: 1, riderId: 3, status: "Out for Delivery" });
    mockPrisma.rider.update.mockResolvedValue({ id: 3, isAvailable: false });

    const res = await request(app)
      .post("/api/admin/orders/1/assign-rider")
      .set("Authorization", ADMIN_TOKEN)
      .send({ riderId: 3 });

    expect(res.status).toBe(200);
    expect(res.body.order.riderId).toBe(3);
    expect(res.body.order.status).toBe("Out for Delivery");
  });
});
