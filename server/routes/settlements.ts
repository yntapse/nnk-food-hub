import { RequestHandler } from "express";
import { prisma } from "../db";

const PLATFORM_FEE_PERCENT = 17;

/** GET /api/hotel/settlements/earnings
 *  Returns earnings breakdown for the authenticated hotel.
 */
export const getHotelEarnings: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const hotelId = parseInt(req.user.id);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [todayOrders, weekOrders, allOrders, pendingSettlement, paidSettlement] = await Promise.all([
      prisma.order.findMany({
        where: { hotelId, status: "Delivered", createdAt: { gte: todayStart } },
        select: { totalPrice: true, hotelPayout: true, itemsPrice: true },
      }),
      prisma.order.findMany({
        where: { hotelId, status: "Delivered", createdAt: { gte: weekStart } },
        select: { totalPrice: true, hotelPayout: true, itemsPrice: true },
      }),
      prisma.order.findMany({
        where: { hotelId, status: "Delivered" },
        select: { totalPrice: true, hotelPayout: true, itemsPrice: true },
      }),
      prisma.settlementRequest.aggregate({
        _sum: { amount: true },
        where: { hotelId, status: "pending" },
      }),
      prisma.settlementRequest.aggregate({
        _sum: { amount: true },
        where: { hotelId, status: "paid" },
      }),
    ]);

    const calcPayout = (orders: typeof todayOrders) =>
      orders.reduce((sum, o) => sum + (o.hotelPayout > 0 ? o.hotelPayout : o.itemsPrice * (100 - PLATFORM_FEE_PERCENT) / 100), 0);

    res.json({
      today: { orders: todayOrders.length, earnings: Math.round(calcPayout(todayOrders) * 100) / 100 },
      week: { orders: weekOrders.length, earnings: Math.round(calcPayout(weekOrders) * 100) / 100 },
      total: { orders: allOrders.length, earnings: Math.round(calcPayout(allOrders) * 100) / 100 },
      pendingSettlement: pendingSettlement._sum.amount || 0,
      paidSettlement: paidSettlement._sum.amount || 0,
    });
  } catch (error) {
    console.error("Error fetching hotel earnings:", error);
    res.status(500).json({ error: "Failed to fetch earnings" });
  }
};

/** POST /api/hotel/settlements/request
 *  Hotel requests a settlement. Emits socket event to admin.
 */
export const requestSettlement: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const hotelId = parseInt(req.user.id);

    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { name: true, upiId: true },
    });
    if (!hotel) { res.status(404).json({ error: "Hotel not found" }); return; }
    if (!hotel.upiId) {
      res.status(400).json({ error: "Please set your UPI ID first before requesting settlement." });
      return;
    }

    // Calculate unsettled earnings (delivered orders minus already requested/paid settlements)
    const [deliveredTotal, settledTotal] = await Promise.all([
      prisma.order.aggregate({
        _sum: { hotelPayout: true },
        where: { hotelId, status: "Delivered" },
      }),
      prisma.settlementRequest.aggregate({
        _sum: { amount: true },
        where: { hotelId },
      }),
    ]);

    const totalEarned = deliveredTotal._sum.hotelPayout || 0;
    const totalSettled = settledTotal._sum.amount || 0;
    const unsettledAmount = Math.round((totalEarned - totalSettled) * 100) / 100;

    if (unsettledAmount <= 0) {
      res.status(400).json({ error: "No unsettled amount to request." });
      return;
    }

    const settlement = await prisma.settlementRequest.create({
      data: {
        hotelId,
        amount: unsettledAmount,
        upiId: hotel.upiId,
      },
    });

    // Notify admin via socket
    const io = req.app.get("io");
    if (io) {
      io.emit("settlementRequest", {
        id: settlement.id,
        hotelName: hotel.name,
        amount: unsettledAmount,
        upiId: hotel.upiId,
      });
    }

    res.status(201).json({ message: "Settlement requested", settlement });
  } catch (error) {
    console.error("Error requesting settlement:", error);
    res.status(500).json({ error: "Failed to request settlement" });
  }
};

/** GET /api/hotel/settlements/history
 *  Returns settlement history for the authenticated hotel.
 */
export const getHotelSettlementHistory: RequestHandler = async (req, res) => {
  try {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const hotelId = parseInt(req.user.id);

    const settlements = await prisma.settlementRequest.findMany({
      where: { hotelId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(settlements);
  } catch (error) {
    console.error("Error fetching settlement history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
};

/** GET /api/admin/settlements/daily-stats
 *  Returns daily collection stats per restaurant for admin.
 */
export const getDailyStats: RequestHandler = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const hotels = await prisma.hotel.findMany({
      select: {
        id: true, name: true, upiId: true,
        orders: {
          where: { status: "Delivered", createdAt: { gte: todayStart } },
          select: { totalPrice: true, hotelPayout: true, platformFee: true, itemsPrice: true },
        },
        _count: {
          select: {
            orders: { where: { status: "Delivered", createdAt: { gte: todayStart } } },
          },
        },
      },
    });

    const stats = hotels.map((hotel) => {
      const totalCollection = hotel.orders.reduce((sum, o) => sum + o.totalPrice, 0);
      const hotelPayout = hotel.orders.reduce((sum, o) => sum + (o.hotelPayout > 0 ? o.hotelPayout : o.itemsPrice * (100 - PLATFORM_FEE_PERCENT) / 100), 0);
      const platformFee = hotel.orders.reduce((sum, o) => sum + (o.platformFee > 0 ? o.platformFee : o.totalPrice * PLATFORM_FEE_PERCENT / 100), 0);
      return {
        hotelId: hotel.id,
        hotelName: hotel.name,
        upiId: hotel.upiId,
        orderCount: hotel._count.orders,
        totalCollection: Math.round(totalCollection * 100) / 100,
        hotelPayout: Math.round(hotelPayout * 100) / 100,
        platformFee: Math.round(platformFee * 100) / 100,
      };
    }).filter((s) => s.orderCount > 0);

    res.json(stats);
  } catch (error) {
    console.error("Error fetching daily stats:", error);
    res.status(500).json({ error: "Failed to fetch daily stats" });
  }
};

/** GET /api/admin/settlements/pending
 *  Returns pending settlement requests for admin.
 */
export const getPendingSettlements: RequestHandler = async (_req, res) => {
  try {
    const settlements = await prisma.settlementRequest.findMany({
      where: { status: "pending" },
      include: { hotel: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(settlements);
  } catch (error) {
    console.error("Error fetching pending settlements:", error);
    res.status(500).json({ error: "Failed to fetch settlements" });
  }
};

/** GET /api/admin/settlements/all
 *  Returns all settlement requests for admin.
 */
export const getAllSettlements: RequestHandler = async (_req, res) => {
  try {
    const settlements = await prisma.settlementRequest.findMany({
      include: { hotel: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(settlements);
  } catch (error) {
    console.error("Error fetching settlements:", error);
    res.status(500).json({ error: "Failed to fetch settlements" });
  }
};

/** PUT /api/admin/settlements/:id/pay
 *  Admin marks a settlement as paid.
 */
export const markSettlementPaid: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid settlement ID" }); return; }

    const { note } = req.body as { note?: string };

    const settlement = await prisma.settlementRequest.update({
      where: { id },
      data: {
        status: "paid",
        paidAt: new Date(),
        ...(note ? { note } : {}),
      },
      include: { hotel: { select: { name: true } } },
    });

    // Notify hotel via socket
    const io = req.app.get("io");
    if (io) {
      io.to(`hotel-${settlement.hotelId}`).emit("settlementPaid", {
        id: settlement.id,
        amount: settlement.amount,
      });
    }

    res.json({ message: "Settlement marked as paid", settlement });
  } catch (error) {
    console.error("Error marking settlement paid:", error);
    res.status(500).json({ error: "Failed to mark settlement paid" });
  }
};
