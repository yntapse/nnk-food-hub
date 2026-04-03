import { prisma } from "../db";

export interface DeliveryFeeSettings {
  deliveryFeeAmount: number;
  freeDeliveryThreshold: number;
  firstOrderFree: boolean;
}

export class DeliveryFeeError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "DeliveryFeeError";
    this.statusCode = statusCode;
  }
}

export const DEFAULT_DELIVERY_FEE_SETTINGS: DeliveryFeeSettings = {
  deliveryFeeAmount: 30,
  freeDeliveryThreshold: 200,
  firstOrderFree: true,
};

export const normalizeDeliveryFeeSettings = (input: Partial<DeliveryFeeSettings>) => ({
  deliveryFeeAmount: Number.isFinite(Number(input.deliveryFeeAmount))
    ? Math.max(0, Number(input.deliveryFeeAmount))
    : DEFAULT_DELIVERY_FEE_SETTINGS.deliveryFeeAmount,
  freeDeliveryThreshold: Number.isFinite(Number(input.freeDeliveryThreshold))
    ? Math.max(0, Number(input.freeDeliveryThreshold))
    : DEFAULT_DELIVERY_FEE_SETTINGS.freeDeliveryThreshold,
  firstOrderFree: typeof input.firstOrderFree === "boolean"
    ? input.firstOrderFree
    : DEFAULT_DELIVERY_FEE_SETTINGS.firstOrderFree,
});

export async function getDeliveryFeeSettings(): Promise<DeliveryFeeSettings> {
  const admin = await prisma.admin.findFirst({
    select: {
      deliveryFeeAmount: true,
      freeDeliveryThreshold: true,
      firstOrderFree: true,
    },
  });

  if (!admin) {
    return DEFAULT_DELIVERY_FEE_SETTINGS;
  }

  return normalizeDeliveryFeeSettings(admin);
}

export async function calculateDeliveryFeeForUser(userId: number, itemsPrice: number) {
  const settings = await getDeliveryFeeSettings();
  const orderCount = await prisma.order.count({ where: { userId } });
  const isFirstOrder = orderCount === 0;
  const qualifiesFirstOrderFree = settings.firstOrderFree && isFirstOrder;
  const qualifiesThresholdFree = itemsPrice >= settings.freeDeliveryThreshold;
  const deliveryFee = qualifiesFirstOrderFree || qualifiesThresholdFree ? 0 : settings.deliveryFeeAmount;

  return {
    settings,
    orderCount,
    isFirstOrder,
    qualifiesFirstOrderFree,
    qualifiesThresholdFree,
    deliveryFee,
    totalPrice: itemsPrice + deliveryFee,
  };
}