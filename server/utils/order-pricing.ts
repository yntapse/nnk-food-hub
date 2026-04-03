import { prisma } from "../db";
import { calculateDeliveryFeeForUser, DeliveryFeeError } from "./delivery-fee";

interface RawOrderItem {
  menuItemId: number | string;
  quantity: number | string;
  name?: string;
}

interface NormalizedOrderItem extends RawOrderItem {
  menuItemId: number;
  quantity: number;
}

export async function getOrderPricing(userId: number, hotelId: number, items: unknown) {
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((item) => {
      const rawItem = item as RawOrderItem;
      const menuItemId = Number(rawItem?.menuItemId);
      const quantity = Number(rawItem?.quantity);

      if (!Number.isInteger(menuItemId) || !Number.isFinite(quantity) || quantity <= 0) {
        return null;
      }

      return {
        ...rawItem,
        menuItemId,
        quantity: Math.floor(quantity),
      } satisfies NormalizedOrderItem;
    })
    .filter((item): item is NormalizedOrderItem => item !== null);

  if (normalizedItems.length === 0) {
    throw new DeliveryFeeError("No valid items selected");
  }

  const requestedMenuItemIds = [...new Set(normalizedItems.map((item) => item.menuItemId))];
  const menuItems = await prisma.menuItem.findMany({
    where: { hotelId, id: { in: requestedMenuItemIds } },
    select: { id: true, name: true, price: true, isAvailable: true },
  });

  if (menuItems.length !== requestedMenuItemIds.length) {
    const foundIds = new Set(menuItems.map((item) => item.id));
    const missingItems = normalizedItems.filter((item) => !foundIds.has(item.menuItemId));
    throw new DeliveryFeeError(
      missingItems.length > 0
        ? `These items are unavailable: ${missingItems.map((item) => item.name || `Item ${item.menuItemId}`).join(", ")}`
        : "One or more selected items are unavailable",
    );
  }

  const unavailableItems = menuItems.filter((item) => !item.isAvailable);
  if (unavailableItems.length > 0) {
    throw new DeliveryFeeError(`These items are unavailable: ${unavailableItems.map((item) => item.name).join(", ")}`);
  }

  const menuItemsById = new Map(menuItems.map((item) => [item.id, item]));
  const itemsPrice = normalizedItems.reduce((sum, item) => {
    const menuItem = menuItemsById.get(item.menuItemId);
    return sum + (menuItem ? menuItem.price * item.quantity : 0);
  }, 0);

  const delivery = await calculateDeliveryFeeForUser(userId, itemsPrice);

  return {
    normalizedItems,
    itemsPrice,
    deliveryFee: delivery.deliveryFee,
    totalPrice: delivery.totalPrice,
    deliverySettings: delivery.settings,
    orderCount: delivery.orderCount,
  };
}