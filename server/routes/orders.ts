import { RequestHandler } from "express";
import { prisma } from "../db";

export const createOrder: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { hotelId, items, totalPrice, itemsPrice, deliveryFee, deliveryAddress, paymentMethod, customerPhone } = req.body;

    const order = await prisma.order.create({
      data: {
        userId: parseInt(req.user.id),
        hotelId: parseInt(hotelId),
        items,
        totalPrice: parseFloat(totalPrice),
        itemsPrice: parseFloat(itemsPrice ?? totalPrice),
        deliveryFee: parseFloat(deliveryFee ?? 0),
        deliveryAddress,
        paymentMethod,
        customerPhone,
        status: "Placed",
      },
    });

    await prisma.hotel.update({
      where: { id: parseInt(hotelId) },
      data: { totalOrders: { increment: 1 } },
    });

    const io = req.app.get("io");
    if (io) { io.to(`hotel-${hotelId}`).emit("newOrder", { order }); }

    res.status(201).json({ message: "Order placed", order });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
};

export const getUserOrders: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const orders = await prisma.order.findMany({
      where: { userId: parseInt(req.user.id) },
      include: {
        hotel: { select: { name: true, location: true } },
        rider: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const getOrderById: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.orderId);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid order ID" }); return; }
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        hotel: { select: { name: true, location: true, phone: true, upiId: true } },
        rider: { select: { name: true, phone: true } },
      },
    });
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
};

export const getRiderOrders: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const orders = await prisma.order.findMany({
      where: { riderId: parseInt(req.user.id) },
      include: {
        hotel: { select: { name: true, location: true } },
        user: { select: { name: true, phone: true, address: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching rider orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const updateOrderStatus: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.orderId);
    const { status } = req.body;
    const order = await prisma.order.update({ where: { id }, data: { status } });

    // When delivered: credit hotel's earnings with item price only (delivery fee goes to admin)
    if (status === "Delivered") {
      await prisma.hotel.update({
        where: { id: order.hotelId },
        data: { totalEarnings: { increment: order.itemsPrice || order.totalPrice } },
      });
    }

    res.json({ message: "Order status updated", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
};
