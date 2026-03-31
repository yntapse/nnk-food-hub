import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore } from "@/stores/authStore";
import { apiUrl } from "@/lib/api";
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, MapPin, Phone, IndianRupee, ShieldCheck } from "lucide-react";

// Extend window for Razorpay
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  modal: { ondismiss: () => void };
}
interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open(): void;
}

export default function Cart() {
  const navigate = useNavigate();
  const { items, hotelName, hotelId, removeItem, updateQuantity, clearCart, getTotal } = useCartStore();
  const { user, token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentId, setPaymentId] = useState(""); // set after successful Razorpay payment
  const savedAddress = user?.address || "";
  const [formData, setFormData] = useState({
    customerPhone: user?.phone || "",
  });

  // Load Razorpay JS SDK once on mount
  useEffect(() => {
    if (document.getElementById("razorpay-sdk")) return;
    const script = document.createElement("script");
    script.id = "razorpay-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  /** Step 1 — Create Razorpay order on server, then open SDK */
  const handleOpenRazorpay = async () => {
    if (!user || !hotelId) { navigate("/login"); return; }
    if (!savedAddress) { alert("Please add a delivery address in your profile before paying."); navigate("/dashboard"); return; }
    if (!formData.customerPhone) { alert("Please enter your phone number."); return; }
    if (!window.Razorpay) { alert("Payment SDK not loaded yet. Please refresh."); return; }

    setPaymentLoading(true);
    try {
      // Create order on server
      const res = await fetch(apiUrl("/api/payment/create-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: getTotal() + deliveryFee }),
      });
      if (!res.ok) { alert("Could not initiate payment. Try again."); return; }
      const { orderId, amount, currency, keyId } = await res.json();

      const options: RazorpayOptions = {
        key: keyId,
        amount,
        currency,
        name: hotelName || "Niphad Food Hub",
        description: "Food Order Payment",
        order_id: orderId,
        handler: async (response: RazorpayResponse) => {
          // Step 2 — Verify signature on server
          const verifyRes = await fetch(apiUrl("/api/payment/verify"), {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(response),
          });
          if (!verifyRes.ok) {
            alert("Payment verification failed. Contact support with payment ID: " + response.razorpay_payment_id);
            return;
          }
          // Step 3 — Payment verified, store paymentId to unlock Place Order
          setPaymentId(response.razorpay_payment_id);
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: formData.customerPhone,
        },
        theme: { color: "#FC8019" },
        modal: {
          ondismiss: () => setPaymentLoading(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Payment error:", err);
      alert("Payment failed. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  /** Step 4 — Payment done, place the food order */
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !hotelId) { navigate("/login"); return; }
    if (!savedAddress) { alert("Please add a delivery address in your profile."); navigate("/dashboard"); return; }
    if (!paymentId) { alert("Please complete the payment first."); return; }
    setLoading(true);

    try {
      const orderData = {
        hotelId,
        items: items.map((item) => ({
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        itemsPrice: getTotal(),
        deliveryFee: deliveryFee,
        totalPrice: getTotal() + deliveryFee,
        deliveryAddress: savedAddress,
        paymentMethod: "UPI",
        paymentId,
        customerPhone: formData.customerPhone,
      };

      const response = await fetch(apiUrl("/api/orders"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {
        const data = await response.json();
        clearCart();
        navigate(`/order/${data.order.id}`);
      } else {
        console.error("Failed to place order");
      }
    } catch (error) {
      console.error("Error placing order:", error);
    } finally {
      setLoading(false);
    }
  };

  /* ── Empty cart ── */
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-32 h-32 bg-secondary rounded-full flex items-center justify-center mb-6">
            <ShoppingBag size={48} className="text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-8 text-center max-w-sm">
            Good food is always cooking! Go ahead, order some yummy items from the menu.
          </p>
          <Link to="/" className="btn-primary px-8 py-3 text-base rounded-2xl">
            Browse Restaurants
          </Link>
        </div>
      </div>
    );
  }

  const deliveryFee = 10;

  return (
    <div className="min-h-screen bg-background pb-28 lg:pb-8">
      <Header />

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Back link + title */}
        <div className="mb-6">
          <Link to={`/restaurant/${hotelId}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-3 transition-colors">
            <ArrowLeft size={16} /> Back to menu
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold">{hotelName}</h1>
          <p className="text-muted-foreground text-sm mt-1">{items.length} item{items.length > 1 ? "s" : ""} in cart</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Cart Items ── */}
          <div className="flex-1">
            <div className="card-base divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0 animate-fade-in">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base truncate">{item.name}</h3>
                    <p className="text-primary font-bold mt-0.5">₹{item.price}</p>
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center bg-primary text-white rounded-xl overflow-hidden shrink-0">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="px-3 py-2 hover:bg-orange-600 transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="px-2 font-bold text-sm min-w-[28px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-3 py-2 hover:bg-orange-600 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Subtotal */}
                  <p className="font-bold w-16 text-right text-sm">₹{item.price * item.quantity}</p>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Checkout Panel ── */}
          <div className="w-full lg:w-96 shrink-0">
            <div className="card-base sticky top-20 space-y-5">
              <h3 className="text-lg font-extrabold">Bill Details</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Item Total</span>
                  <span className="font-semibold">₹{getTotal()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span className="font-semibold">₹{deliveryFee}</span>
                </div>
              </div>

              <div className="flex justify-between font-extrabold text-lg pt-3 border-t border-border">
                <span>TO PAY</span>
                <span>₹{getTotal() + deliveryFee}</span>
              </div>

              {/* Checkout form */}
              <form onSubmit={handlePlaceOrder} className="space-y-4 pt-2">
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <MapPin size={14} className="text-primary" /> Delivery Address
                  </label>
                  {savedAddress ? (
                    <div className="flex items-start gap-2 bg-secondary rounded-xl px-4 py-3">
                      <MapPin size={14} className="text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium break-words">{savedAddress}</p>
                        <Link to="/dashboard" className="text-xs text-primary hover:underline">Change address</Link>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                      No address saved.{" "}
                      <Link to="/dashboard" className="font-bold underline">Add address in your profile</Link>
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Phone size={14} className="text-primary" /> Phone Number
                  </label>
                  <input
                    type="tel"
                    name="customerPhone"
                    value={formData.customerPhone}
                    onChange={handleChange}
                    required
                    className="input-base"
                    placeholder="+91 98765 43210"
                  />
                </div>

                {/* Payment Section */}
                {!paymentId ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleOpenRazorpay}
                      disabled={paymentLoading || !savedAddress}
                      className="btn-primary w-full py-4 text-base rounded-2xl shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <IndianRupee size={18} />
                      {paymentLoading ? "Opening Payment..." : `Pay ₹${getTotal() + deliveryFee} via Razorpay`}
                    </button>
                    <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                      <ShieldCheck size={12} className="text-green-500" />
                      Secured by Razorpay · UPI, PhonePe, GPay supported
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-green-500 bg-green-50 text-green-700">
                      <ShieldCheck size={20} className="text-green-500 shrink-0" />
                      <div>
                        <p className="text-sm font-bold">Payment Successful ✓</p>
                        <p className="text-xs opacity-75">ID: {paymentId}</p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary w-full py-4 text-base rounded-2xl shadow-xl disabled:opacity-50"
                    >
                      {loading ? "Placing Order..." : `Confirm Order  •  ₹${getTotal() + deliveryFee}`}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-white/95 backdrop-blur-md border-t border-border lg:hidden">
        <div className="flex items-center justify-between text-sm mb-2 px-1">
          <span className="text-muted-foreground">{items.length} item{items.length > 1 ? "s" : ""}</span>
          <span className="font-extrabold text-lg">₹{getTotal() + deliveryFee}</span>
        </div>
      </div>
    </div>
  );
}
