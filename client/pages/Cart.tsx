import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import GoogleMapEmbed from "@/components/GoogleMapEmbed";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore } from "@/stores/authStore";
import { apiUrl } from "@/lib/api";
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, MapPin, Phone, IndianRupee, ShieldCheck, PartyPopper, Bike } from "lucide-react";

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

interface DeliveryFeeSettings {
  deliveryFeeAmount: number;
  freeDeliveryThreshold: number;
  firstOrderFree: boolean;
}

const NIPHAD_BUS_STAND = {
  latitude: 20.0827,
  longitude: 74.1097,
};
const MAX_ORDER_DISTANCE_KM = 8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function getDistanceInKm(fromLatitude: number, fromLongitude: number, toLatitude: number, toLongitude: number): number {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(toLatitude - fromLatitude);
  const deltaLon = toRadians(toLongitude - fromLongitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(fromLatitude)) *
      Math.cos(toRadians(toLatitude)) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export default function Cart() {
  const navigate = useNavigate();
  const { items, hotelName, hotelId, removeItem, updateQuantity, clearCart, getTotal } = useCartStore();
  const { user, token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [razorpayOrderId, setRazorpayOrderId] = useState("");
  const [transferId, setTransferId] = useState("");
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [deliverySettings, setDeliverySettings] = useState<DeliveryFeeSettings | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");
  const savedAddress = user?.address || "";
  const [formData, setFormData] = useState({
    customerPhone: user?.phone || "",
  });

  useEffect(() => {
    if (!token) return;

    Promise.all([
      fetch(apiUrl("/api/orders/count"), {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(apiUrl("/api/admin/delivery-settings")).then((r) => r.json()),
    ])
      .then(([countData, settingsData]) => {
        setOrderCount(countData.count ?? 0);
        setDeliverySettings(settingsData);
      })
      .catch(() => {
        setOrderCount(0);
        setDeliverySettings(null);
      });
  }, [token]);

  const subtotal = getTotal();
  const isFirstOrder = orderCount === 0;
  const isAboveMinimum = deliverySettings ? subtotal >= deliverySettings.freeDeliveryThreshold : false;
  const isFreeDelivery = deliverySettings
    ? (deliverySettings.firstOrderFree && isFirstOrder) || isAboveMinimum
    : false;
  const deliveryFee = orderCount === null || !deliverySettings
    ? 0
    : (isFreeDelivery ? 0 : deliverySettings.deliveryFeeAmount);
  const totalToPay = subtotal + deliveryFee;

  // Load Razorpay JS SDK once on mount
  useEffect(() => {
    if (document.getElementById("razorpay-sdk")) return;
    const script = document.createElement("script");
    script.id = "razorpay-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Geocode the saved delivery address to get coordinates for the 8 km distance check
  useEffect(() => {
    if (!savedAddress) {
      setDeliveryCoords(null);
      setGeocoding(false);
      return;
    }

    // Extract the geocodable location part (last segment of "Home | details | location")
    const geocodableText = savedAddress.includes(" | ")
      ? (savedAddress.split(" | ").pop() ?? savedAddress).trim()
      : savedAddress.trim();

    if (!geocodableText) {
      setDeliveryCoords(null);
      return;
    }

    const controller = new AbortController();
    setGeocoding(true);
    setGeocodeError("");

    const fetchCoords = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(geocodableText)}`,
          { signal: controller.signal, headers: { Accept: "application/json" } },
        );
        if (!response.ok) throw new Error("Geocode request failed");
        const results = (await response.json()) as Array<{ lat: string; lon: string }>;
        if (results.length > 0) {
          setDeliveryCoords({
            latitude: parseFloat(results[0].lat),
            longitude: parseFloat(results[0].lon),
          });
          setGeocodeError("");
        } else {
          setDeliveryCoords(null);
          setGeocodeError("Could not verify delivery address location. Please update your address.");
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setDeliveryCoords(null);
        setGeocodeError("Address location check failed. Please try again.");
      } finally {
        if (!controller.signal.aborted) setGeocoding(false);
      }
    };

    fetchCoords();
    return () => controller.abort();
  }, [savedAddress]);

  // Distance of the delivery address (not GPS) from Niphad Bus Stand
  const distanceFromNiphadBusStand = deliveryCoords
    ? getDistanceInKm(
      NIPHAD_BUS_STAND.latitude,
      NIPHAD_BUS_STAND.longitude,
      deliveryCoords.latitude,
      deliveryCoords.longitude,
    )
    : null;
  const isOutsideServiceArea = distanceFromNiphadBusStand !== null && distanceFromNiphadBusStand > MAX_ORDER_DISTANCE_KM;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  /** Step 1 — Create Razorpay order on server, then open SDK */
  const handleOpenRazorpay = async () => {
    if (!user || !hotelId) { navigate("/login"); return; }
    if (!savedAddress) { alert("Please add a delivery address in your profile before paying."); navigate("/dashboard"); return; }
    if (!formData.customerPhone) { alert("Please enter your phone number."); return; }
    if (geocoding) { alert("Verifying your delivery address location, please wait."); return; }
    if (!deliveryCoords) { alert("Could not verify delivery address location. Please update your address."); return; }
    if (isOutsideServiceArea) {
      alert(`Your delivery address is ${distanceFromNiphadBusStand?.toFixed(2)} km from Niphad Bus Stand. Ordering is only available within ${MAX_ORDER_DISTANCE_KM} km.`);
      return;
    }
    if (!window.Razorpay) { alert("Payment SDK not loaded yet. Please refresh."); return; }

    setPaymentLoading(true);
    try {
      // Create order on server
      const res = await fetch(apiUrl("/api/payment/create-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          hotelId,
          items: items.map((item) => ({
            menuItemId: item.id,
            name: item.name,
            quantity: item.quantity,
          })),
        }),
      });
      if (!res.ok) { alert("Could not initiate payment. Try again."); return; }
      const { orderId, amount, currency, keyId } = await res.json();

      const options: RazorpayOptions = {
        key: keyId,
        amount,
        currency,
        name: hotelName || "Niphad Bites",
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
          const verifyData = await verifyRes.json();
          setPaymentId(response.razorpay_payment_id);
          setRazorpayOrderId(response.razorpay_order_id);
          setTransferId(verifyData.transferId || "");
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
    if (geocoding || !deliveryCoords) { alert("Could not verify delivery address location. Please update your address."); return; }
    if (isOutsideServiceArea) {
      alert(`Ordering is allowed only within ${MAX_ORDER_DISTANCE_KM} km of Niphad Bus Stand. Your delivery address is ${distanceFromNiphadBusStand?.toFixed(2)} km away.`);
      return;
    }
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
        deliveryAddress: savedAddress,
        paymentMethod: "UPI",
        paymentId,
        razorpayOrderId,
        transferId,
        customerPhone: formData.customerPhone,
        userLatitude: deliveryCoords!.latitude,
        userLongitude: deliveryCoords!.longitude,
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
        const data = await response.json().catch(() => null);
        alert(data?.error || "Failed to place order");
      }
    } catch (error) {
      console.error("Error placing order:", error);
    } finally {
      setLoading(false);
    }
  };

  /* ── Empty cart ── */
  if (items.length === 0) {    return (
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

              {/* Free delivery banner */}
              {orderCount !== null && deliverySettings && isFreeDelivery && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-sm text-green-700">
                  <PartyPopper size={15} className="shrink-0 text-green-600" />
                  <span className="font-semibold">
                    {deliverySettings.firstOrderFree && isFirstOrder
                      ? "First order - Free delivery!"
                      : `Order above ₹${deliverySettings.freeDeliveryThreshold} - Free delivery!`}
                  </span>
                </div>
              )}
              {orderCount !== null && deliverySettings && !isFreeDelivery && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-600">
                  <Bike size={13} className="shrink-0" />
                  <span>Add items worth <span className="font-bold">₹{Math.max(0, deliverySettings.freeDeliveryThreshold - subtotal)}</span> more to get free delivery</span>
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Radius</span>
                  <span className="font-semibold">Within {MAX_ORDER_DISTANCE_KM} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Address</span>
                  <span className={`font-semibold text-right max-w-[140px] truncate ${isOutsideServiceArea ? "text-red-600" : geocoding ? "text-muted-foreground" : deliveryCoords ? "text-green-600" : "text-amber-600"}`}>
                    {geocoding ? "Checking..." : distanceFromNiphadBusStand !== null ? `${distanceFromNiphadBusStand.toFixed(2)} km away` : "Not verified"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Item Total</span>
                  <span className="font-semibold">₹{subtotal}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  {orderCount === null ? (
                    <span className="text-xs text-muted-foreground animate-pulse">Calculating…</span>
                  ) : isFreeDelivery ? (
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="line-through text-muted-foreground text-xs">₹{deliverySettings?.deliveryFeeAmount ?? 0}</span>
                      <span className="text-green-600 font-bold">FREE</span>
                    </span>
                  ) : (
                    <span className="font-semibold">₹{deliveryFee}</span>
                  )}
                </div>
              </div>

              <div className="flex justify-between font-extrabold text-lg pt-3 border-t border-border">
                <span>TO PAY</span>
                <span>₹{totalToPay}</span>
              </div>

              {/* Checkout form */}
              <form onSubmit={handlePlaceOrder} className="space-y-4 pt-2">
                {(geocodeError || isOutsideServiceArea) && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    {geocodeError || `Your delivery address is ${distanceFromNiphadBusStand?.toFixed(1)} km from Niphad Bus Stand. Delivery is only available within ${MAX_ORDER_DISTANCE_KM} km. Please update your address.`}
                  </div>
                )}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <MapPin size={14} className="text-primary" /> Delivery Address
                  </label>
                  {savedAddress ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 bg-secondary rounded-xl px-4 py-3">
                        <MapPin size={14} className="text-primary mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium break-words">{savedAddress}</p>
                          <Link to="/dashboard" className="text-xs text-primary hover:underline">Change address</Link>
                        </div>
                      </div>

                      <GoogleMapEmbed
                        query={savedAddress}
                        title="Delivery location"
                        heightClassName="h-48"
                      />
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
                      disabled={paymentLoading || !savedAddress || orderCount === null || deliverySettings === null || geocoding || !deliveryCoords || isOutsideServiceArea}
                      className="btn-primary w-full py-4 text-base rounded-2xl shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <IndianRupee size={18} />
                      {paymentLoading ? "Opening Payment..." : `Pay ₹${totalToPay} via Razorpay`}
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
                      {loading ? "Placing Order..." : `Confirm Order  •  ₹${totalToPay}`}
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
          <span className="font-extrabold text-lg">₹{totalToPay}</span>
        </div>
      </div>
    </div>
  );
}
