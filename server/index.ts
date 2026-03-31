import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./db";
import { createServer as createHttpServer } from "http";
import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { signup, login } from "./routes/auth";
import * as hotelsRoutes from "./routes/hotels";
import * as ordersRoutes from "./routes/orders";
import * as ridersRoutes from "./routes/riders";
import * as adminRoutes from "./routes/admin";
import { authMiddleware, requireRole } from "./middleware/auth";
import { verifyToken } from "./utils/auth";
import { handleDemo } from "./routes/demo";
import { createPaymentOrder, verifyPayment } from "./routes/payment";
import { seedDB } from "./seed";

let dbConnected = false;

async function connectDB() {
  try {
    await prisma.$connect();
    dbConnected = true;
    console.log("MySQL connected");
    // Seed default accounts on first run (skips if they already exist)
    await seedDB();
  } catch (error) {
    console.error("MySQL connection error:", error);
    // Keep server alive so frontend can boot.
    // API routes return 503 until DB is available.
  }
}

export function createServer(existingHttpServer?: HttpServer) {
  const app = express();
  const httpServer = existingHttpServer ?? createHttpServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Return fast when MySQL is unavailable.
  app.use("/api", (req, res, next) => {
    if (req.path === "/ping" || req.path === "/demo") {
      next();
      return;
    }

    if (!dbConnected) {
      res.status(503).json({
        error: "Database unavailable. Configure DATABASE_URL and retry.",
      });
      return;
    }

    next();
  });

  // Connect to MongoDB
  connectDB();

  // Socket.io middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }

    try {
      const decoded = verifyToken(token);
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error("Authentication error"));
    }
  });

  // Socket.io event handlers
  io.on("connection", (socket) => {
    const userId = socket.data.user?.id;
    const role = socket.data.user?.role;

    // Join user-specific room for direct messages
    socket.join(`user-${userId}`);

    // Hotels and riders join their own rooms
    if (role === "hotel") socket.join(`hotel-${userId}`);
    if (role === "rider") socket.join(`rider-${userId}`);

    socket.on("riderOnline", (data) => {
      io.emit("riderAvailable", data);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Attach io to app for use in routes
  app.set("io", io);

  // Authentication Routes
  app.post("/api/auth/signup", signup);
  app.post("/api/auth/login", login);

  // User profile routes
  app.use("/api/user", authMiddleware, requireRole("user"));
  app.get("/api/user/profile", async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: parseInt(req.user!.id) },
        select: { id: true, name: true, email: true, phone: true, address: true },
      });
      res.json(user);
    } catch { res.status(500).json({ error: "Failed to fetch profile" }); }
  });
  app.put("/api/user/profile", async (req, res) => {
    try {
      const { address, phone } = req.body;
      const data: Record<string, string> = {};
      if (address !== undefined) data.address = address;
      if (phone !== undefined) data.phone = phone;
      const user = await prisma.user.update({
        where: { id: parseInt(req.user!.id) },
        data,
        select: { id: true, name: true, email: true, phone: true, address: true },
      });
      res.json({ message: "Profile updated", user });
    } catch { res.status(500).json({ error: "Failed to update profile" }); }
  });

  // Payment Routes (authenticated users only)
  app.use("/api/payment", authMiddleware, requireRole("user"));
  app.post("/api/payment/create-order", createPaymentOrder);
  app.post("/api/payment/verify", verifyPayment);

  // Hotel Routes (public and authenticated)
  app.get("/api/hotels", hotelsRoutes.getAllHotels);
  app.get("/api/hotels/:hotelId", hotelsRoutes.getHotelById);
  app.get("/api/hotels/:hotelId/menu", hotelsRoutes.getHotelMenu);

  // Hotel authenticated routes
  app.use("/api/hotel", authMiddleware, requireRole("hotel"));
  app.get("/api/hotel/profile", hotelsRoutes.getHotelProfile);
  app.put("/api/hotel/profile", hotelsRoutes.updateHotelProfile);
  app.get("/api/hotel/menu/all", hotelsRoutes.getHotelMenuAll);
  app.post("/api/hotel/menu", hotelsRoutes.addMenuItem);
  app.put("/api/hotel/menu/:itemId", hotelsRoutes.updateMenuItem);
  app.delete("/api/hotel/menu/:itemId", hotelsRoutes.deleteMenuItem);
  app.get("/api/hotel/orders", hotelsRoutes.getHotelOrders);
  app.put("/api/hotel/orders/:orderId/status", hotelsRoutes.updateOrderStatus);

  // Order Routes
  app.use("/api/orders", authMiddleware);
  app.post("/api/orders", ordersRoutes.createOrder);
  app.get("/api/orders/my-orders", ordersRoutes.getUserOrders);
  app.get("/api/orders/:orderId", ordersRoutes.getOrderById);
  app.put("/api/orders/:orderId/status", ordersRoutes.updateOrderStatus);

  // Rider Routes
  app.use("/api/rider", authMiddleware, requireRole("rider"));
  app.get("/api/rider/profile", ridersRoutes.getRiderProfile);
  app.put("/api/rider/status", ridersRoutes.updateRiderStatus);
  app.put("/api/rider/availability", ridersRoutes.updateRiderAvailability);
  app.post("/api/rider/accept/:orderId", ridersRoutes.acceptDelivery);
  app.post("/api/rider/complete/:orderId", ridersRoutes.completeDelivery);
  app.get("/api/rider/earnings", ridersRoutes.getRiderEarnings);
  app.get("/api/rider/orders", ridersRoutes.getRiderOrders);
  app.get("/api/riders/available", ridersRoutes.getAvailableRiders);

  // Public admin endpoint — must be BEFORE the auth middleware
  app.get("/api/admin/upi", adminRoutes.getAdminUpi);

  // Admin Routes
  app.use("/api/admin", authMiddleware, requireRole("admin"));
  app.get("/api/admin/users", adminRoutes.getAllUsers);
  app.get("/api/admin/riders", adminRoutes.getAllRiders);
  app.get("/api/admin/hotels", adminRoutes.getAllHotels);
  app.post("/api/admin/riders", adminRoutes.createRider);
  app.post("/api/admin/hotels", adminRoutes.createHotel);
  app.delete("/api/admin/riders/:riderId", adminRoutes.deleteRider);
  app.patch("/api/admin/riders/:riderId/toggle", adminRoutes.toggleRider);
  app.put("/api/admin/riders/:riderId", adminRoutes.updateRider);
  app.delete("/api/admin/hotels/:hotelId", adminRoutes.deleteHotel);
  app.patch("/api/admin/hotels/:hotelId/toggle", adminRoutes.toggleHotel);
  app.put("/api/admin/hotels/:hotelId", adminRoutes.updateHotel);
  app.delete("/api/admin/users/:userId", adminRoutes.deleteUser);
  app.get("/api/admin/analytics", adminRoutes.getAnalytics);
  app.get("/api/admin/orders", adminRoutes.getAllOrders);
  app.post("/api/admin/orders/:orderId/assign-rider", adminRoutes.assignRiderToOrder);
  app.put("/api/admin/upi", adminRoutes.updateAdminUpi);

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  return { app, httpServer };
}
