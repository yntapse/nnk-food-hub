import { prisma } from "../db";

export async function autoAssignRider(orderId: number) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) { console.log("Order not found"); return null; }
    if (order.riderId) { console.log("Order already has a rider assigned"); return order; }

    const availableRiders = await prisma.rider.findMany({
      where: { isOnline: true, isAvailable: true },
      include: {
        _count: { select: { orders: { where: { status: "Out for Delivery" } } } },
      },
    });

    if (availableRiders.length === 0) { console.log("No available riders"); return null; }

    let assignedRider = availableRiders[0];
    if (availableRiders.length > 3) {
      assignedRider = availableRiders.reduce((prev, curr) =>
        prev._count.orders <= curr._count.orders ? prev : curr
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { riderId: assignedRider.id, status: "Out for Delivery" },
    });
    await prisma.rider.update({
      where: { id: assignedRider.id },
      data: { isAvailable: false },
    });

    console.log(`Order ${orderId} assigned to rider ${assignedRider.id}`);
    return updatedOrder;
  } catch (error) {
    console.error("Error in auto-assign rider:", error);
    return null;
  }
}

export async function queueOrderForLaterAssignment(orderId: number) {
  try {
    await prisma.order.update({ where: { id: orderId }, data: { status: "Ready" } });
    console.log(`Order ${orderId} queued for later rider assignment`);
  } catch (error) {
    console.error("Error queuing order:", error);
  }
}

export async function assignPendingOrders(riderId: number) {
  try {
    const pendingOrder = await prisma.order.findFirst({
      where: { status: "Ready", riderId: null },
    });
    if (!pendingOrder) return;

    await prisma.order.update({
      where: { id: pendingOrder.id },
      data: { riderId, status: "Out for Delivery" },
    });
    await prisma.rider.update({
      where: { id: riderId },
      data: { isAvailable: false },
    });
    console.log(`Pending order ${pendingOrder.id} assigned to rider ${riderId}`);
  } catch (error) {
    console.error("Error assigning pending orders:", error);
  }
}
