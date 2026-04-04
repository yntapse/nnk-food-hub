import { RequestHandler } from "express";
import { prisma } from "../db";
import { DeliveryFeeError } from "../utils/delivery-fee";
import { getOrderPricing } from "../utils/order-pricing";
import { MAX_ORDER_DISTANCE_KM, validateDeliveryDistance } from "../utils/location-validation";

const PLATFORM_FEE_PERCENT = 17;

export const createOrder: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { hotelId, items, deliveryAddress, paymentMethod, paymentId, razorpayOrderId, transferId, customerPhone, userLatitude, userLongitude } = req.body;

    // Payment is mandatory — no COD allowed
    if (!paymentId || !razorpayOrderId) {
      res.status(400).json({ error: "Payment is required to place an order." });
      return;
    }

    const latitude = Number(userLatitude);
    const longitude = Number(userLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      res.status(400).json({
        error: "Location is required to place an order. Please enable location access.",
      });
      return;
    }

    const distanceCheck = validateDeliveryDistance(latitude, longitude);
    if (!distanceCheck.allowed) {
      res.status(400).json({
        error: `Ordering is available only within ${MAX_ORDER_DISTANCE_KM} km of Niphad Bus Stand. Your location is ${distanceCheck.distanceKm.toFixed(2)} km away.`,
      });
      return;
    }

    const parsedHotelId = parseInt(hotelId);
    const hotel = await prisma.hotel.findUnique({
      where: { id: parsedHotelId },
      select: { id: true, name: true, isOpen: true },
    });

    if (!hotel) { res.status(404).json({ error: "Restaurant not found" }); return; }
    if (!hotel.isOpen) { res.status(400).json({ error: "This restaurant is currently offline" }); return; }

    const pricing = await getOrderPricing(parseInt(req.user.id), parsedHotelId, items);

    const platformFee = Math.round(pricing.totalPrice * PLATFORM_FEE_PERCENT) / 100;
    const hotelPayout = Math.round(pricing.totalPrice * (100 - PLATFORM_FEE_PERCENT)) / 100;

    const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

    const order = await prisma.order.create({
      data: {
        userId: parseInt(req.user.id),
        hotelId: parsedHotelId,
        items,
        totalPrice: pricing.totalPrice,
        itemsPrice: pricing.itemsPrice,
        deliveryFee: pricing.deliveryFee,
        deliveryAddress,
        paymentMethod: paymentMethod || "UPI",
        paymentId: paymentId || "",
        razorpayOrderId: razorpayOrderId || "",
        platformFee,
        hotelPayout,
        transferId: transferId || "",
        customerPhone,
        status: "Placed",
        deliveryOtp,
      },
    });

    await prisma.hotel.update({
      where: { id: parsedHotelId },
      data: { totalOrders: { increment: 1 } },
    });

    const io = req.app.get("io");
    if (io) { io.to(`hotel-${parsedHotelId}`).emit("newOrder", { order }); }

    res.status(201).json({ message: "Order placed", order });
  } catch (error) {
    if (error instanceof DeliveryFeeError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
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

export const getUserOrderCount: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const count = await prisma.order.count({
      where: { userId: parseInt(req.user.id) },
    });
    res.json({ count });
  } catch (error) {
    console.error("Error counting user orders:", error);
    res.status(500).json({ error: "Failed to count orders" });
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
