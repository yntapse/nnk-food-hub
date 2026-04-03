/**
 * Unit tests for server/utils/delivery-fee.ts
 * Tests calculation logic without HTTP layer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    $connect: vi.fn(() => Promise.resolve()),
    admin: { findFirst: vi.fn() },
    order: { count: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock("../db", () => ({ prisma: mockPrisma }));

import {
  getDeliveryFeeSettings,
  calculateDeliveryFeeForUser,
  normalizeDeliveryFeeSettings,
  DEFAULT_DELIVERY_FEE_SETTINGS,
} from "../utils/delivery-fee";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getDeliveryFeeSettings ───────────────────────────────────────────────────
describe("getDeliveryFeeSettings()", () => {
  it("returns defaults when no admin record exists", async () => {
    mockPrisma.admin.findFirst.mockResolvedValue(null);

    const settings = await getDeliveryFeeSettings();
    expect(settings).toEqual(DEFAULT_DELIVERY_FEE_SETTINGS);
  });

  it("returns admin-configured values from the database", async () => {
    mockPrisma.admin.findFirst.mockResolvedValue({
      deliveryFeeAmount: 50,
      freeDeliveryThreshold: 500,
      firstOrderFree: false,
    });

    const settings = await getDeliveryFeeSettings();
    expect(settings.deliveryFeeAmount).toBe(50);
    expect(settings.freeDeliveryThreshold).toBe(500);
    expect(settings.firstOrderFree).toBe(false);
  });
});

// ── calculateDeliveryFeeForUser ──────────────────────────────────────────────
describe("calculateDeliveryFeeForUser()", () => {
  const userId = 42;

  beforeEach(() => {
    mockPrisma.admin.findFirst.mockResolvedValue({
      deliveryFeeAmount: 30,
      freeDeliveryThreshold: 200,
      firstOrderFree: true,
    });
  });

  it("gives free delivery on first order when firstOrderFree is enabled", async () => {
    mockPrisma.order.count.mockResolvedValue(0);

    const result = await calculateDeliveryFeeForUser(userId, 100);
    expect(result.deliveryFee).toBe(0);
    expect(result.qualifiesFirstOrderFree).toBe(true);
  });

  it("charges delivery fee on first order when firstOrderFree is disabled", async () => {
    mockPrisma.admin.findFirst.mockResolvedValue({
      deliveryFeeAmount: 30,
      freeDeliveryThreshold: 200,
      firstOrderFree: false,
    });
    mockPrisma.order.count.mockResolvedValue(0);

    const result = await calculateDeliveryFeeForUser(userId, 100);
    expect(result.deliveryFee).toBe(30);
    expect(result.qualifiesFirstOrderFree).toBe(false);
  });

  it("charges delivery fee on 2nd+ order when itemsPrice is below threshold", async () => {
    mockPrisma.order.count.mockResolvedValue(3);

    const result = await calculateDeliveryFeeForUser(userId, 150);
    expect(result.deliveryFee).toBe(30);
    expect(result.qualifiesThresholdFree).toBe(false);
  });

  it("gives free delivery when itemsPrice meets the threshold (200)", async () => {
    mockPrisma.order.count.mockResolvedValue(3);

    const result = await calculateDeliveryFeeForUser(userId, 200);
    expect(result.deliveryFee).toBe(0);
    expect(result.qualifiesThresholdFree).toBe(true);
  });

  it("gives free delivery when itemsPrice exceeds threshold", async () => {
    mockPrisma.order.count.mockResolvedValue(5);

    const result = await calculateDeliveryFeeForUser(userId, 350);
    expect(result.deliveryFee).toBe(0);
    expect(result.qualifiesThresholdFree).toBe(true);
  });

  it("uses custom delivery fee amount from admin settings", async () => {
    mockPrisma.admin.findFirst.mockResolvedValue({
      deliveryFeeAmount: 60,
      freeDeliveryThreshold: 500,
      firstOrderFree: false,
    });
    mockPrisma.order.count.mockResolvedValue(2);

    const result = await calculateDeliveryFeeForUser(userId, 100);
    expect(result.deliveryFee).toBe(60);
  });

  it("uses custom threshold from admin settings", async () => {
    mockPrisma.admin.findFirst.mockResolvedValue({
      deliveryFeeAmount: 30,
      freeDeliveryThreshold: 100,
      firstOrderFree: false,
    });
    mockPrisma.order.count.mockResolvedValue(2);

    const result = await calculateDeliveryFeeForUser(userId, 100);
    expect(result.deliveryFee).toBe(0); // meets 100 threshold
  });
});

// ── normalizeDeliveryFeeSettings ─────────────────────────────────────────────
describe("normalizeDeliveryFeeSettings()", () => {
  it("clamps negative deliveryFeeAmount to 0", () => {
    const result = normalizeDeliveryFeeSettings({ deliveryFeeAmount: -20 });
    expect(result.deliveryFeeAmount).toBe(0);
  });

  it("clamps negative freeDeliveryThreshold to 0", () => {
    const result = normalizeDeliveryFeeSettings({ freeDeliveryThreshold: -100 });
    expect(result.freeDeliveryThreshold).toBe(0);
  });

  it("falls back to defaults for missing fields", () => {
    const result = normalizeDeliveryFeeSettings({});
    expect(result).toEqual(DEFAULT_DELIVERY_FEE_SETTINGS);
  });

  it("falls back to defaults for non-numeric values", () => {
    const result = normalizeDeliveryFeeSettings({
      deliveryFeeAmount: "abc" as unknown as number,
      freeDeliveryThreshold: NaN,
    });
    expect(result.deliveryFeeAmount).toBe(DEFAULT_DELIVERY_FEE_SETTINGS.deliveryFeeAmount);
    expect(result.freeDeliveryThreshold).toBe(DEFAULT_DELIVERY_FEE_SETTINGS.freeDeliveryThreshold);
  });
});
