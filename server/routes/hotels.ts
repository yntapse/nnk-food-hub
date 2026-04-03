import { RequestHandler } from "express";
import { prisma } from "../db";
import {
  autoAssignRider,
  queueOrderForLaterAssignment,
} from "../utils/rider-assignment";

const hotelPublicSelect = {
  id: true, name: true, email: true, phone: true, location: true,
  category: true, rating: true, totalOrders: true, totalEarnings: true,
  isOpen: true, upiId: true, createdAt: true, updatedAt: true,
};

export const getAllHotels: RequestHandler = async (_req, res) => {
  try {
    const hotels = await prisma.hotel.findMany({
      select: hotelPublicSelect,
      orderBy: [
        { isOpen: "desc" },
        { rating: "desc" },
      ],
    });
    res.json(hotels);
  } catch (error) {
    console.error("Error fetching hotels:", error);
    res.status(500).json({ error: "Failed to fetch hotels" });
  }
};

export const getHotelById: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.hotelId);
    const hotel = await prisma.hotel.findUnique({ where: { id }, select: hotelPublicSelect });
    if (!hotel) { res.status(404).json({ error: "Hotel not found" }); return; }
    res.json(hotel);
  } catch (error) {
    console.error("Error fetching hotel:", error);
    res.status(500).json({ error: "Failed to fetch hotel" });
  }
};

export const getHotelMenu: RequestHandler = async (req, res) => {
  try {
    const hotelId = parseInt(req.params.hotelId);
    const menuItems = await prisma.menuItem.findMany({
      where: { hotelId },
      orderBy: { category: "asc" },
    });
    res.json(menuItems);
  } catch (error) {
    console.error("Error fetching menu:", error);
    res.status(500).json({ error: "Failed to fetch menu" });
  }
};

export const updateHotelProfile: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { name, phone, location, category, isOpen, upiId } = req.body;
    const hotel = await prisma.hotel.update({
      where: { id: parseInt(req.user.id) },
      data: { name, phone, location, category, isOpen, upiId },
      select: hotelPublicSelect,
    });
    res.json({ message: "Profile updated", hotel });
  } catch (error) {
    console.error("Error updating hotel profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

export const getHotelProfile: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const hotel = await prisma.hotel.findUnique({
      where: { id: parseInt(req.user.id) },
      select: hotelPublicSelect,
    });
    if (!hotel) { res.status(404).json({ error: "Hotel not found" }); return; }
    res.json(hotel);
  } catch (error) {
    console.error("Error fetching hotel profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const getHotelMenuAll: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const menuItems = await prisma.menuItem.findMany({
      where: { hotelId: parseInt(req.user.id) },
      orderBy: { category: "asc" },
    });
    res.json(menuItems);
  } catch (error) {
    console.error("Error fetching all menu items:", error);
    res.status(500).json({ error: "Failed to fetch menu" });
  }
};

export const addMenuItem: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { name, price, category, description, image } = req.body;
    const menuItem = await prisma.menuItem.create({
      data: {
        name,
        price: parseFloat(price),
        category,
        description,
        image: image || "",
        hotelId: parseInt(req.user.id),
      },
    });
    res.status(201).json({ message: "Menu item added", menuItem });
  } catch (error) {
    console.error("Error adding menu item:", error);
    res.status(500).json({ error: "Failed to add menu item" });
  }
};

export const updateMenuItem: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const id = parseInt(req.params.itemId);
    const { name, price, category, description, isAvailable, image } = req.body;
    const menuItem = await prisma.menuItem.update({
      where: { id },
      data: { name, price: price !== undefined ? parseFloat(price) : undefined, category, description, isAvailable, image },
    });
    res.json({ message: "Menu item updated", menuItem });
  } catch (error) {
    console.error("Error updating menu item:", error);
    res.status(500).json({ error: "Failed to update menu item" });
  }
};

export const deleteMenuItem: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const id = parseInt(req.params.itemId);
    await prisma.menuItem.delete({ where: { id } });
    res.json({ message: "Menu item deleted" });
  } catch (error) {
    console.error("Error deleting menu item:", error);
    res.status(500).json({ error: "Failed to delete menu item" });
  }
};

export const getHotelOrders: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const orders = await prisma.order.findMany({
      where: { hotelId: parseInt(req.user.id) },
      include: { user: { select: { name: true, phone: true, address: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching hotel orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const updateOrderStatus: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const orderId = parseInt(req.params.orderId);
    const { status } = req.body;

    const order = await prisma.order.update({ where: { id: orderId }, data: { status } });

    const io = req.app.get("io");
    if (io) {
      io.to(`user-${order.userId}`).emit("orderStatusUpdate", { orderId, status });
    }

    if (status === "Ready") {
      const assignedOrder = await autoAssignRider(orderId);
      if (assignedOrder) {
        if (io && assignedOrder.riderId) {
          io.to(`rider-${assignedOrder.riderId}`).emit("orderAssigned", { orderId, order: assignedOrder });
          io.to(`user-${order.userId}`).emit("orderStatusUpdate", { orderId, status: "Out for Delivery" });
        }
      } else {
        await queueOrderForLaterAssignment(orderId);
      }
      const updatedOrder = await prisma.order.findUnique({ where: { id: orderId } });
      res.json({ message: "Order status updated and rider assigned", order: updatedOrder });
      return;
    }

    res.json({ message: "Order status updated", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
};
