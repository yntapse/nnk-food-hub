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

import { createServer } from "../index";

const waitTick = () => new Promise<void>((r) => setTimeout(r, 50));

const makeToken = (id: number, role: string) =>
  `Bearer ${jwt.sign({ id: String(id), email: `${role}@test.com`, role }, JWT_SECRET, { expiresIn: "7d" })}`;

const USER_TOKEN = makeToken(10, "user");
const USER_ID = 10;

// Default admin delivery settings
const DELIVERY_SETTINGS = {
  deliveryFeeAmount: 30,
  freeDeliveryThreshold: 200,
  firstOrderFree: true,
};

// A working hotel
const HOTEL_OPEN = { id: 5, name: "Biryani House", isOpen: true };
const HOTEL_CLOSED = { id: 5, name: "Biryani House", isOpen: false };

// A valid menu item
const MENU_ITEM = { id: 1, name: "Biryani", price: 150, isAvailable: true, hotelId: 5 };

let app: Express;

beforeAll(async () => {
  const { app: a } = createServer();
  app = a;
  await waitTick();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$connect.mockResolvedValue(undefined);
  // Default: hotel is open
  mockPrisma.hotel.findUnique.mockResolvedValue(HOTEL_OPEN);
  // Default: 1 menu item
  mockPrisma.menuItem.findMany.mockResolvedValue([MENU_ITEM]);
  // Default: admin delivery settings
  mockPrisma.admin.findFirst.mockResolvedValue(DELIVERY_SETTINGS);
});

// ── CREATE ORDER ─────────────────────────────────────────────────────────────
describe("POST /api/orders", () => {
  it("creates order with standard delivery fee (30) on 2nd+ order", async () => {
    mockPrisma.order.count.mockResolvedValue(1); // 1 previous order
    mockPrisma.order.create.mockResolvedValue({
      id: 100, userId: USER_ID, hotelId: 5, totalPrice: 180,
      itemsPrice: 150, deliveryFee: 30, status: "Placed",
    });
    mockPrisma.hotel.update.mockResolvedValue({});

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", USER_TOKEN)
      .send({
        hotelId: 5,
        items: [{ menuItemId: 1, quantity: 1, name: "Biryani", price: 150 }],
        deliveryAddress: "123 Main St",
        paymentMethod: "COD",
        customerPhone: "9999999999",
      });

    expect(res.status).toBe(201);
    expect(res.body.order.deliveryFee).toBe(30);
    expect(res.body.order.totalPrice).toBe(180);
    expect(res.body.order.itemsPrice).toBe(150);
  });

  it("first order is free (deliveryFee = 0) when firstOrderFree is on", async () => {
    mockPrisma.order.count.mockResolvedValue(0); // no previous orders
    mockPrisma.order.create.mockResolvedValue({
      id: 101, userId: USER_ID, hotelId: 5, totalPrice: 150,
      itemsPrice: 150, deliveryFee: 0, status: "Placed",
    });
    mockPrisma.hotel.update.mockResolvedValue({});

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", USER_TOKEN)
      .send({
        hotelId: 5,
        items: [{ menuItemId: 1, quantity: 1, name: "Biryani", price: 150 }],
        deliveryAddress: "456 Park Ave",
        paymentMethod: "COD",
        customerPhone: "9999999999",
      });

    expect(res.status).toBe(201);
    expect(res.body.order.deliveryFee).toBe(0);
  });

  it("free delivery when itemsPrice meets threshold (200+)", async () => {
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { id: 2, name: "Thali", price: 250, isAvailable: true, hotelId: 5 },
    ]);
    mockPrisma.order.count.mockResolvedValue(3); // not first order
    mockPrisma.order.create.mockResolvedValue({
      id: 102, userId: USER_ID, hotelId: 5, totalPrice: 250,
      itemsPrice: 250, deliveryFee: 0, status: "Placed",
    });
    mockPrisma.hotel.update.mockResolvedValue({});

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", USER_TOKEN)
      .send({
        hotelId: 5,
        items: [{ menuItemId: 2, quantity: 1, name: "Thali", price: 250 }],
        deliveryAddress: "789 MG Road",
        paymentMethod: "COD",
        customerPhone: "9999999999",
      });

    expect(res.status).toBe(201);
    expect(res.body.order.deliveryFee).toBe(0);
  });

  it("returns 400 when restaurant is closed", async () => {
    mockPrisma.hotel.findUnique.mockResolvedValue(HOTEL_CLOSED);

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", USER_TOKEN)
      .send({
        hotelId: 5,
        items: [{ menuItemId: 1, quantity: 1, name: "Biryani", price: 150 }],
        deliveryAddress: "Anywhere",
        paymentMethod: "COD",
        customerPhone: "9999999999",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/offline/i);
  });

  it("returns 400 for unavailable menu item", async () => {
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { id: 1, name: "Biryani", price: 150, isAvailable: false, hotelId: 5 },
    ]);
    mockPrisma.order.count.mockResolvedValue(1);

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", USER_TOKEN)
      .send({
        hotelId: 5,
        items: [{ menuItemId: 1, quantity: 1, name: "Biryani", price: 150 }],
        deliveryAddress: "Anywhere",
        paymentMethod: "COD",
        customerPhone: "9999999999",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unavailable/i);
  });

  it("returns 401 for unauthenticated request", async () => {
    const res = await request(app).post("/api/orders").send({
      hotelId: 5, items: [], deliveryAddress: "x", paymentMethod: "COD",
    });
    expect(res.status).toBe(401);
  });
});

// ── GET ORDER COUNT ──────────────────────────────────────────────────────────
describe("GET /api/orders/count", () => {
  it("returns the user's order count", async () => {
    mockPrisma.order.count.mockResolvedValue(5);

    const res = await request(app)
      .get("/api/orders/count")
      .set("Authorization", USER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(5);
  });
});

// ── GET MY ORDERS ────────────────────────────────────────────────────────────
describe("GET /api/orders/my-orders", () => {
  it("returns all orders for the logged-in user", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 100, status: "Delivered", totalPrice: 180, userId: USER_ID },
    ]);

    const res = await request(app)
      .get("/api/orders/my-orders")
      .set("Authorization", USER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe("Delivered");
  });
});

// ── GET ORDER BY ID ──────────────────────────────────────────────────────────
describe("GET /api/orders/:orderId", () => {
  it("returns a single order by id", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 100, status: "Placed", totalPrice: 180,
      hotel: { name: "Biryani House", location: "Downtown" },
      rider: null,
    });

    const res = await request(app)
      .get("/api/orders/100")
      .set("Authorization", USER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(100);
    expect(res.body.hotel.name).toBe("Biryani House");
  });

  it("returns 404 for non-existent order", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/orders/999")
      .set("Authorization", USER_TOKEN);

    expect(res.status).toBe(404);
  });
});
