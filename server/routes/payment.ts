import { RequestHandler } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";

function getRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Razorpay keys not configured");
  }
  return new Razorpay({ key_id, key_secret });
}

/** POST /api/payment/create-order
 *  Creates a Razorpay order on the server (amount in rupees, converted to paise)
 */
export const createPaymentOrder: RequestHandler = async (req, res) => {
  try {
    const { amount } = req.body as { amount: number };
    if (!amount || typeof amount !== "number" || amount <= 0) {
      res.status(400).json({ error: "Invalid amount" });
      return;
    }

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // convert ₹ to paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Payment order creation failed";
    console.error("Razorpay create order error:", err);
    res.status(500).json({ error: message });
  }
};

/** POST /api/payment/verify
 *  Verifies payment signature after successful payment
 *  Must be called before placing the food order
 */
export const verifyPayment: RequestHandler = (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ error: "Missing payment fields" });
      return;
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      res.status(500).json({ error: "Razorpay not configured" });
      return;
    }

    // HMAC-SHA256 verification (Razorpay standard)
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      res.status(400).json({ error: "Payment verification failed. Invalid signature." });
      return;
    }

    res.json({
      verified: true,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });
  } catch (err) {
    console.error("Razorpay verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
};
