import { RequestHandler } from "express";
import { prisma } from "../db";
import { assignPendingOrders } from "../utils/rider-assignment";

const riderPublicSelect = {
  id: true, name: true, email: true, phone: true,
  isOnline: true, isAvailable: true, totalEarnings: true,
  rating: true, createdAt: true, updatedAt: true,
};

export const getRiderProfile: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const rider = await prisma.rider.findUnique({
      where: { id: parseInt(req.user.id) },
      select: {
        ...riderPublicSelect,
        orders: { where: { status: "Out for Delivery" }, select: { id: true, status: true } },
      },
    });
    res.json(rider);
  } catch (error) {
    console.error("Error fetching rider profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const updateRiderStatus: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { isOnline } = req.body;
    const rider = await prisma.rider.update({
      where: { id: parseInt(req.user.id) },
      data: { isOnline, isAvailable: isOnline ? true : false },
      select: riderPublicSelect,
    });
    res.json({ message: "Status updated", rider });
  } catch (error) {
    console.error("Error updating rider status:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
};

export const updateRiderAvailability: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { isAvailable } = req.body;
    const rider = await prisma.rider.update({
      where: { id: parseInt(req.user.id) },
      data: { isAvailable },
      select: riderPublicSelect,
    });
    res.json({ message: "Availability updated", rider });
  } catch (error) {
    console.error("Error updating availability:", error);
    res.status(500).json({ error: "Failed to update availability" });
  }
};

export const acceptDelivery: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const orderId = parseInt(req.params.orderId);
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status: "Out for Delivery", riderId: parseInt(req.user.id) },
    });
    await prisma.rider.update({
      where: { id: parseInt(req.user.id) },
      data: { isAvailable: false },
    });
    res.json({ message: "Delivery accepted", order });
  } catch (error) {
    console.error("Error accepting delivery:", error);
    res.status(500).json({ error: "Failed to accept delivery" });
  }
};

export const completeDelivery: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const orderId = parseInt(req.params.orderId);
    const riderId = parseInt(req.user.id);

    const order = await prisma.order.update({ where: { id: orderId }, data: { status: "Delivered" } });
    const earning = Math.round(order.totalPrice * 0.1);
    await prisma.rider.update({
      where: { id: riderId },
      data: { totalEarnings: { increment: earning } },
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`user-${order.userId}`).emit("orderStatusUpdate", { orderId, status: "Delivered" });
    }

    const activeCount = await prisma.order.count({
      where: { riderId, status: "Out for Delivery" },
    });
    if (activeCount === 0) {
      await prisma.rider.update({ where: { id: riderId }, data: { isAvailable: true } });
      await assignPendingOrders(riderId);
    }

    res.json({ message: "Delivery completed", order });
  } catch (error) {
    console.error("Error completing delivery:", error);
    res.status(500).json({ error: "Failed to complete delivery" });
  }
};

export const getRiderEarnings: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const riderId = parseInt(req.user.id);
    const rider = await prisma.rider.findUnique({ where: { id: riderId }, select: { totalEarnings: true } });
    const completedOrders = await prisma.order.count({ where: { riderId, status: "Delivered" } });
    const activeOrders = await prisma.order.count({ where: { riderId, status: "Out for Delivery" } });
    res.json({
      totalEarnings: rider?.totalEarnings || 0,
      completedDeliveries: completedOrders,
      activeDeliveries: activeOrders,
    });
  } catch (error) {
    console.error("Error fetching earnings:", error);
    res.status(500).json({ error: "Failed to fetch earnings" });
  }
};

export const getAvailableRiders: RequestHandler = async (_req, res) => {
  try {
    const riders = await prisma.rider.findMany({
      where: { isOnline: true, isAvailable: true },
      select: riderPublicSelect,
    });
    res.json(riders);
  } catch (error) {
    console.error("Error fetching available riders:", error);
    res.status(500).json({ error: "Failed to fetch riders" });
  }
};

export const getRiderOrders: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const riderId = parseInt(req.user.id);
    const orders = await prisma.order.findMany({
      where: { OR: [{ riderId }, { status: "Ready", riderId: null }] },
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
