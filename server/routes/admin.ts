import { RequestHandler } from "express";
import { prisma } from "../db";
import { hashPassword } from "../utils/auth";
import {
  getDeliveryFeeSettings,
  normalizeDeliveryFeeSettings,
} from "../utils/delivery-fee";

const normalizeRating = (rating: unknown) => {
  const parsedRating = Number(rating);
  if (!Number.isFinite(parsedRating)) return undefined;
  return Math.min(5, Math.max(1, parsedRating));
};

const userSelect = {
  id: true, name: true, email: true, phone: true,
  address: true, createdAt: true, updatedAt: true,
};
const riderSelect = {
  id: true, name: true, email: true, phone: true, isOnline: true,
  isAvailable: true, totalEarnings: true, rating: true, createdAt: true, updatedAt: true,
};
const hotelSelect = {
  id: true, name: true, email: true, phone: true, location: true,
  category: true, rating: true, totalOrders: true, totalEarnings: true,
  isOpen: true, razorpayAccountId: true, createdAt: true, updatedAt: true,
};

export const getAllUsers: RequestHandler = async (_req, res) => {
  try {
    const users = await prisma.user.findMany({ select: userSelect });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const getAllRiders: RequestHandler = async (_req, res) => {
  try {
    const riders = await prisma.rider.findMany({ select: riderSelect });
    res.json(riders);
  } catch (error) {
    console.error("Error fetching riders:", error);
    res.status(500).json({ error: "Failed to fetch riders" });
  }
};

export const getAllHotels: RequestHandler = async (_req, res) => {
  try {
    const hotels = await prisma.hotel.findMany({ select: hotelSelect });
    res.json(hotels);
  } catch (error) {
    console.error("Error fetching hotels:", error);
    res.status(500).json({ error: "Failed to fetch hotels" });
  }
};

export const createRider: RequestHandler = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const existing = await prisma.rider.findUnique({ where: { email } });
    if (existing) { res.status(400).json({ error: "Rider already exists" }); return; }
    if (phone) {
      const phoneExists = await prisma.rider.findFirst({ where: { phone: { endsWith: phone.replace(/\D/g, "").slice(-10) } } });
      if (phoneExists) { res.status(400).json({ error: "This phone number is already registered as a rider" }); return; }
    }
    const hashedPassword = await hashPassword(password);
    const rider = await prisma.rider.create({
      data: { name, email, phone, password: hashedPassword },
      select: riderSelect,
    });
    res.status(201).json({ message: "Rider created", rider });
  } catch (error) {
    console.error("Error creating rider:", error);
    res.status(500).json({ error: "Failed to create rider" });
  }
};

export const createHotel: RequestHandler = async (req, res) => {
  try {
    const { name, email, phone, password, location, category, rating, razorpayAccountId } = req.body;
    const existing = await prisma.hotel.findUnique({ where: { email } });
    if (existing) { res.status(400).json({ error: "Hotel already exists" }); return; }
    if (phone) {
      const phoneExists = await prisma.hotel.findFirst({ where: { phone: { endsWith: phone.replace(/\D/g, "").slice(-10) } } });
      if (phoneExists) { res.status(400).json({ error: "This phone number is already registered as a restaurant" }); return; }
    }
    const hashedPassword = await hashPassword(password);
    const normalizedRating = normalizeRating(rating);
    const hotel = await prisma.hotel.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        location,
        category,
        ...(normalizedRating !== undefined ? { rating: normalizedRating } : {}),
        ...(razorpayAccountId ? { razorpayAccountId } : {}),
      },
      select: hotelSelect,
    });
    res.status(201).json({ message: "Hotel created", hotel });
  } catch (error) {
    console.error("Error creating hotel:", error);
    res.status(500).json({ error: "Failed to create hotel" });
  }
};

export const getAdminUpi: RequestHandler = async (_req, res) => {
  try {
    const admin = await prisma.admin.findFirst({ select: { upiId: true, name: true } });
    res.json({ upiId: admin?.upiId || "", name: admin?.name || "Admin" });
  } catch (error) {
    console.error("Error fetching admin UPI:", error);
    res.status(500).json({ error: "Failed to fetch admin UPI" });
  }
};

export const updateAdminUpi: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { upiId } = req.body;
    const admin = await prisma.admin.update({
      where: { id: parseInt(req.user.id) },
      data: { upiId },
      select: { upiId: true },
    });
    res.json({ message: "Admin UPI updated", upiId: admin.upiId });
  } catch (error) {
    console.error("Error updating admin UPI:", error);
    res.status(500).json({ error: "Failed to update admin UPI" });
  }
};

export const getDeliverySettings: RequestHandler = async (_req, res) => {
  try {
    const settings = await getDeliveryFeeSettings();
    res.json(settings);
  } catch (error) {
    console.error("Error fetching delivery settings:", error);
    res.status(500).json({ error: "Failed to fetch delivery settings" });
  }
};

export const updateDeliverySettings: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }

    const settings = normalizeDeliveryFeeSettings(req.body ?? {});
    const admin = await prisma.admin.update({
      where: { id: parseInt(req.user.id) },
      data: settings,
      select: {
        deliveryFeeAmount: true,
        freeDeliveryThreshold: true,
        firstOrderFree: true,
      },
    });

    res.json({ message: "Delivery settings updated", settings: admin });
  } catch (error) {
    console.error("Error updating delivery settings:", error);
    res.status(500).json({ error: "Failed to update delivery settings" });
  }
};

export const deleteRider: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.riderId);
    await prisma.rider.delete({ where: { id } });
    res.json({ message: "Rider deleted" });
  } catch (error) {
    console.error("Error deleting rider:", error);
    res.status(500).json({ error: "Failed to delete rider" });
  }
};

export const deleteHotel: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.hotelId);
    await prisma.hotel.delete({ where: { id } });
    res.json({ message: "Hotel deleted" });
  } catch (error) {
    console.error("Error deleting hotel:", error);
    res.status(500).json({ error: "Failed to delete hotel" });
  }
};

export const deleteUser: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.userId);
    await prisma.user.delete({ where: { id } });
    res.json({ message: "User deleted" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

export const toggleRider: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.riderId);
    const rider = await prisma.rider.findUnique({ where: { id }, select: { isAvailable: true } });
    const updated = await prisma.rider.update({ where: { id }, data: { isAvailable: !rider?.isAvailable } });
    res.json({ message: "Rider availability updated", isAvailable: updated.isAvailable });
  } catch (error) {
    console.error("Error toggling rider:", error);
    res.status(500).json({ error: "Failed to toggle rider" });
  }
};

export const updateRider: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.riderId);
    const { name, phone, password } = req.body;
    const data: Record<string, string> = {};
    if (name) data.name = name;
    if (phone) data.phone = phone;
    if (password) data.password = await hashPassword(password);
    const updated = await prisma.rider.update({ where: { id }, data, select: { id: true, name: true, email: true, phone: true, isOnline: true, isAvailable: true } });
    res.json({ message: "Rider updated", rider: updated });
  } catch (error) {
    console.error("Error updating rider:", error);
    res.status(500).json({ error: "Failed to update rider" });
  }
};

export const toggleHotel: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.hotelId);
    const hotel = await prisma.hotel.findUnique({ where: { id }, select: { isOpen: true } });
    const updated = await prisma.hotel.update({ where: { id }, data: { isOpen: !hotel?.isOpen } });
    res.json({ message: "Hotel status updated", isOpen: updated.isOpen });
  } catch (error) {
    console.error("Error toggling hotel:", error);
    res.status(500).json({ error: "Failed to toggle hotel" });
  }
};

export const updateHotel: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.hotelId);
    const { name, phone, password, location, category, rating, razorpayAccountId } = req.body;
    const data: Record<string, string | number> = {};
    if (name) data.name = name;
    if (phone) data.phone = phone;
    if (password) data.password = await hashPassword(password);
    if (location) data.location = location;
    if (category) data.category = category;
    if (razorpayAccountId !== undefined) data.razorpayAccountId = razorpayAccountId;
    const normalizedRating = normalizeRating(rating);
    if (normalizedRating !== undefined) data.rating = normalizedRating;
    const updated = await prisma.hotel.update({ where: { id }, data, select: { id: true, name: true, email: true, phone: true, location: true, category: true, rating: true, isOpen: true, razorpayAccountId: true } });
    res.json({ message: "Hotel updated", hotel: updated });
  } catch (error) {
    console.error("Error updating hotel:", error);
    res.status(500).json({ error: "Failed to update hotel" });
  }
};

export const getAnalytics: RequestHandler = async (_req, res) => {
  try {
    const [totalUsers, totalRiders, totalHotels, totalOrders, deliveredOrders, onlineRiders] =
      await Promise.all([
        prisma.user.count(),
        prisma.rider.count(),
        prisma.hotel.count(),
        prisma.order.count({ where: { status: { not: "Cancelled" } } }),
        prisma.order.count({ where: { status: "Delivered" } }),
        prisma.rider.count({ where: { isOnline: true } }),
      ]);
    const revenueResult = await prisma.order.aggregate({
      _sum: { deliveryFee: true },
      where: { status: "Delivered" },
    });
    res.json({
      totalUsers,
      totalRiders,
      totalHotels,
      totalOrders,
      deliveredOrders,
      totalRevenue: revenueResult._sum.deliveryFee || 0,
      onlineRiders,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
};

export const getAllOrders: RequestHandler = async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: { select: { name: true, phone: true } },
        hotel: { select: { name: true, location: true } },
        rider: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const assignRiderToOrder: RequestHandler = async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const riderId = parseInt(req.body.riderId);
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { riderId, status: "Out for Delivery" },
    });
    await prisma.rider.update({
      where: { id: riderId },
      data: { isAvailable: false },
    });
    res.json({ message: "Rider assigned", order });
  } catch (error) {
    console.error("Error assigning rider:", error);
    res.status(500).json({ error: "Failed to assign rider" });
  }
};
