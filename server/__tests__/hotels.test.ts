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

const waitTick = () => new Promise<void>((r) => setTimeout(r, 50));

const makeToken = (id: number, role: string) =>
  `Bearer ${jwt.sign({ id: String(id), email: `${role}@test.com`, role }, JWT_SECRET, { expiresIn: "7d" })}`;

const HOTEL_TOKEN = makeToken(5, "hotel");

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

// ── PUBLIC HOTEL ENDPOINTS ───────────────────────────────────────────────────
describe("GET /api/hotels", () => {
  it("returns all hotels ordered by isOpen and rating", async () => {
    mockPrisma.hotel.findMany.mockResolvedValue([
      { id: 1, name: "Biryani House", rating: 4.5, isOpen: true },
      { id: 2, name: "Pizza Point", rating: 3.0, isOpen: false },
    ]);

    const res = await request(app).get("/api/hotels");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe("Biryani House");
  });
});

describe("GET /api/hotels/:hotelId", () => {
  it("returns a single hotel by id", async () => {
    mockPrisma.hotel.findUnique.mockResolvedValue({ id: 1, name: "Biryani House", isOpen: true });

    const res = await request(app).get("/api/hotels/1");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Biryani House");
  });

  it("returns 404 for unknown hotel", async () => {
    mockPrisma.hotel.findUnique.mockResolvedValue(null);
    const res = await request(app).get("/api/hotels/999");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/hotels/:hotelId/menu", () => {
  it("returns menu items for a hotel", async () => {
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { id: 10, name: "Chicken Biryani", price: 180, isAvailable: true, hotelId: 1 },
    ]);

    const res = await request(app).get("/api/hotels/1/menu");
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe("Chicken Biryani");
  });
});

// ── HOTEL AUTH ENDPOINTS ─────────────────────────────────────────────────────
describe("GET /api/hotel/profile", () => {
  it("returns the hotel's own profile", async () => {
    mockPrisma.hotel.findUnique.mockResolvedValue({ id: 5, name: "MyHotel", isOpen: true });

    const res = await request(app)
      .get("/api/hotel/profile")
      .set("Authorization", HOTEL_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("MyHotel");
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/hotel/profile");
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/hotel/profile", () => {
  it("updates hotel profile fields", async () => {
    mockPrisma.hotel.update.mockResolvedValue({
      id: 5, name: "Updated Hotel", phone: "9876543210", isOpen: false,
    });

    const res = await request(app)
      .put("/api/hotel/profile")
      .set("Authorization", HOTEL_TOKEN)
      .send({ name: "Updated Hotel", phone: "9876543210", isOpen: false });

    expect(res.status).toBe(200);
    expect(res.body.hotel.name).toBe("Updated Hotel");
  });

  it("can toggle isOpen to offline", async () => {
    mockPrisma.hotel.update.mockResolvedValue({ id: 5, isOpen: false });

    const res = await request(app)
      .put("/api/hotel/profile")
      .set("Authorization", HOTEL_TOKEN)
      .send({ isOpen: false });

    expect(res.status).toBe(200);
    expect(res.body.hotel.isOpen).toBe(false);
  });
});

// ── MENU ITEMS ───────────────────────────────────────────────────────────────
describe("POST /api/hotel/menu", () => {
  it("adds a new menu item", async () => {
    mockPrisma.menuItem.create.mockResolvedValue({
      id: 20, name: "Paneer Tikka", price: 120, category: "Starters", hotelId: 5,
    });

    const res = await request(app)
      .post("/api/hotel/menu")
      .set("Authorization", HOTEL_TOKEN)
      .send({ name: "Paneer Tikka", price: 120, category: "Starters" });

    expect(res.status).toBe(201);
    expect(res.body.menuItem.name).toBe("Paneer Tikka");
  });
});

describe("PUT /api/hotel/menu/:itemId", () => {
  it("updates a menu item and can toggle isAvailable", async () => {
    mockPrisma.menuItem.update.mockResolvedValue({
      id: 20, name: "Paneer Tikka", price: 130, isAvailable: false,
    });

    const res = await request(app)
      .put("/api/hotel/menu/20")
      .set("Authorization", HOTEL_TOKEN)
      .send({ price: 130, isAvailable: false });

    expect(res.status).toBe(200);
    expect(res.body.menuItem.isAvailable).toBe(false);
  });
});

describe("DELETE /api/hotel/menu/:itemId", () => {
  it("deletes a menu item", async () => {
    mockPrisma.menuItem.delete.mockResolvedValue({ id: 20 });

    const res = await request(app)
      .delete("/api/hotel/menu/20")
      .set("Authorization", HOTEL_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });
});

// ── HOTEL ORDER MANAGEMENT ───────────────────────────────────────────────────
describe("GET /api/hotel/orders", () => {
  it("returns orders for the hotel", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 1, status: "Placed", totalPrice: 210, hotelId: 5 },
    ]);

    const res = await request(app)
      .get("/api/hotel/orders")
      .set("Authorization", HOTEL_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe("Placed");
  });
});

describe("PUT /api/hotel/orders/:orderId/status", () => {
  const orderId = 1;

  it("hotel accepts an order (Accepted status)", async () => {
    mockPrisma.order.update.mockResolvedValue({ id: orderId, userId: 10, status: "Accepted" });
    mockPrisma.order.findUnique.mockResolvedValue({ id: orderId, status: "Accepted", userId: 10 });

    const res = await request(app)
      .put(`/api/hotel/orders/${orderId}/status`)
      .set("Authorization", HOTEL_TOKEN)
      .send({ status: "Accepted" });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("Accepted");
  });

  it("hotel marks order as Preparing", async () => {
    mockPrisma.order.update.mockResolvedValue({ id: orderId, userId: 10, status: "Preparing" });
    mockPrisma.order.findUnique.mockResolvedValue({ id: orderId, status: "Preparing" });

    const res = await request(app)
      .put(`/api/hotel/orders/${orderId}/status`)
      .set("Authorization", HOTEL_TOKEN)
      .send({ status: "Preparing" });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("Preparing");
  });

  it("hotel marks order as Ready - triggers autoAssignRider", async () => {
    const { autoAssignRider } = await import("../utils/rider-assignment");

    mockPrisma.order.update.mockResolvedValue({ id: orderId, userId: 10, status: "Ready" });
    mockPrisma.order.findUnique.mockResolvedValue({
      id: orderId, status: "Out for Delivery", riderId: 3, userId: 10,
    });
    (autoAssignRider as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: orderId, riderId: 3, userId: 10, status: "Out for Delivery",
    });

    const res = await request(app)
      .put(`/api/hotel/orders/${orderId}/status`)
      .set("Authorization", HOTEL_TOKEN)
      .send({ status: "Ready" });

    expect(res.status).toBe(200);
    expect(autoAssignRider).toHaveBeenCalledWith(orderId);
  });
});
